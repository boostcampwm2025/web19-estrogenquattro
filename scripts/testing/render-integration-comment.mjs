import fs from "node:fs";
import path from "node:path";

const THRESHOLD = 80;

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    args[key.replace(/^--/, "")] = value;
  }
  return args;
}

function readJsonIfExists(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return null;
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function readLinesIfExists(filePath) {
  if (!filePath) return [];
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return [];
  return fs
    .readFileSync(resolved, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatPct(metric) {
  return `${Number(metric?.pct ?? 0).toFixed(2)}%`;
}

function formatDelta(currentMetric, baselineMetric) {
  if (!baselineMetric) return "n/a";
  const delta = Number((currentMetric.pct - baselineMetric.pct).toFixed(2));
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`;
}

function findDomain(report, domainKey) {
  return report?.domains?.find((domain) => domain.domainKey === domainKey) ?? null;
}

function aggregateFiles(files) {
  const initial = {
    lines: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
  };

  for (const file of files) {
    for (const key of Object.keys(initial)) {
      initial[key].total += Number(file[key]?.total ?? 0);
      initial[key].covered += Number(file[key]?.covered ?? 0);
    }
  }

  return Object.fromEntries(
    Object.entries(initial).map(([key, value]) => [
      key,
      {
        total: value.total,
        covered: value.covered,
        pct: value.total === 0 ? 100 : Number(((value.covered / value.total) * 100).toFixed(2)),
      },
    ]),
  );
}

function changedCoverage(report, changedFiles) {
  const relevantFiles = report.files.filter((file) => changedFiles.includes(file.path));
  return {
    fileCount: relevantFiles.length,
    metrics: aggregateFiles(relevantFiles),
  };
}

function groupTestsByDomain(report) {
  const grouped = new Map();

  for (const test of report.tests) {
    const domainEntry =
      grouped.get(test.domainKey) ??
      {
        domainKey: test.domainKey,
        domainLabel: test.domainLabel,
        features: new Map(),
      };
    const featureEntry = domainEntry.features.get(test.featureKey) ?? {
      featureKey: test.featureKey,
      featureLabel: test.featureLabel,
      tests: [],
    };
    featureEntry.tests.push(test.title);
    domainEntry.features.set(test.featureKey, featureEntry);
    grouped.set(test.domainKey, domainEntry);
  }

  return [...grouped.values()].map((domain) => ({
    domainKey: domain.domainKey,
    domainLabel: domain.domainLabel,
    features: [...domain.features.values()].sort((left, right) =>
      left.featureLabel.localeCompare(right.featureLabel, "ko"),
    ),
  }));
}

function renderPlatformSection(currentReport, baselineReport) {
  const testsByDomain = groupTestsByDomain(currentReport);
  const sortedDomains = [...currentReport.domains].sort((left, right) => {
    const leftWarning = left.lines.pct < THRESHOLD ? 0 : 1;
    const rightWarning = right.lines.pct < THRESHOLD ? 0 : 1;
    if (leftWarning !== rightWarning) return leftWarning - rightWarning;
    return left.domainLabel.localeCompare(right.domainLabel, "ko");
  });

  const lines = [`#### ${currentReport.platformLabel}`, ""];

  for (const domain of sortedDomains) {
    const warning = domain.lines.pct < THRESHOLD;
    const summary = [
      `<strong>${domain.domainLabel}</strong>`,
      `<code>${formatPct(domain.lines)}</code>`,
      warning ? "🚨 <strong>경고: 80% 미만</strong>" : "✅ 통과",
    ].join(" — ");
    const detailsTag = warning ? "<details open>" : "<details>";
    lines.push(detailsTag);
    lines.push(`<summary>${summary}</summary>`);
    lines.push("");

    const baselineDomain = findDomain(baselineReport, domain.domainKey);
    if (baselineDomain) {
      lines.push(
        `- 기준선 대비: ${formatDelta(domain.lines, baselineDomain.lines)} (${formatPct(
          baselineDomain.lines,
        )} -> ${formatPct(domain.lines)})`,
      );
    }

    const domainTests = testsByDomain.find(
      (entry) => entry.domainKey === domain.domainKey,
    );
    if (!domainTests || domainTests.features.length === 0) {
      lines.push("- 통과한 통합 테스트 스냅샷이 아직 없습니다.");
      lines.push("");
      lines.push("</details>");
      lines.push("");
      continue;
    }

    for (const feature of domainTests.features) {
      const visibleTests = feature.tests.slice(0, 6);
      for (const testTitle of visibleTests) {
        lines.push(`- ${feature.featureLabel}: ${testTitle}`);
      }
      if (feature.tests.length > visibleTests.length) {
        lines.push(
          `- ${feature.featureLabel}: 외 ${feature.tests.length - visibleTests.length}건`,
        );
      }
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines;
}

function main() {
  const args = parseArgs(process.argv);
  const currentBackend = readJsonIfExists(args["current-backend"]);
  const currentFrontend = readJsonIfExists(args["current-frontend"]);
  const baselineBackend = readJsonIfExists(args["baseline-backend"]);
  const baselineFrontend = readJsonIfExists(args["baseline-frontend"]);
  const changedFiles = readLinesIfExists(args["changed-files"]);

  const outputPath = path.resolve(process.cwd(), args.output);
  const gateOutputPath = path.resolve(process.cwd(), args["gate-output"]);

  const changedBackend = changedCoverage(currentBackend, changedFiles);
  const changedFrontend = changedCoverage(currentFrontend, changedFiles);
  const currentChangedMetrics = aggregateFiles([
    ...currentBackend.files.filter((file) => changedFiles.includes(file.path)),
    ...currentFrontend.files.filter((file) => changedFiles.includes(file.path)),
  ]);
  const baselineChangedMetrics = aggregateFiles([
    ...(baselineBackend?.files ?? []).filter((file) => changedFiles.includes(file.path)),
    ...(baselineFrontend?.files ?? []).filter((file) => changedFiles.includes(file.path)),
  ]);

  const warnings = [];
  for (const report of [currentFrontend, currentBackend]) {
    if (report.totals.lines.pct < THRESHOLD) {
      warnings.push(
        `- ${report.platformLabel} 전체 — ${formatPct(report.totals.lines)}`,
      );
    }

    for (const domain of report.domains) {
      if (domain.lines.pct < THRESHOLD) {
        warnings.push(
          `- ${report.platformLabel} / ${domain.domainLabel} — ${formatPct(domain.lines)}`,
        );
      }
    }
  }

  if (
    currentChangedMetrics.lines.total > 0 &&
    currentChangedMetrics.lines.pct < THRESHOLD
  ) {
    warnings.unshift(`- 변경 파일 — ${formatPct(currentChangedMetrics.lines)}`);
  }

  const gate = {
    shouldFail: false,
    reasons: [],
  };

  for (const [current, baseline] of [
    [currentBackend, baselineBackend],
    [currentFrontend, baselineFrontend],
  ]) {
    if (!baseline) continue;
    const delta = Number((current.totals.lines.pct - baseline.totals.lines.pct).toFixed(2));
    if (delta < 0) {
      gate.shouldFail = true;
      gate.reasons.push(
        `${current.platformLabel} line coverage dropped by ${Math.abs(delta).toFixed(2)}%`,
      );
    }
  }

  const lines = [
    "<!-- integration-coverage-report -->",
    "## 통합 테스트 스펙 스냅샷",
    "",
    "### 전체 커버리지 요약",
    "",
    "| 범위 | Base | PR | Delta | 상태 |",
    "| --- | ---: | ---: | ---: | --- |",
    `| 프론트엔드 전체 | ${baselineFrontend ? `\`${formatPct(baselineFrontend.totals.lines)}\`` : "`n/a`"} | \`${formatPct(currentFrontend.totals.lines)}\` | ${baselineFrontend ? `\`${formatDelta(currentFrontend.totals.lines, baselineFrontend.totals.lines)}\`` : "`n/a`"} | ${currentFrontend.totals.lines.pct < THRESHOLD ? "🚨 **80% 미만**" : "✅ 통과"} |`,
    `| 백엔드 전체 | ${baselineBackend ? `\`${formatPct(baselineBackend.totals.lines)}\`` : "`n/a`"} | \`${formatPct(currentBackend.totals.lines)}\` | ${baselineBackend ? `\`${formatDelta(currentBackend.totals.lines, baselineBackend.totals.lines)}\`` : "`n/a`"} | ${currentBackend.totals.lines.pct < THRESHOLD ? "🚨 **80% 미만**" : "✅ 통과"} |`,
    `| 변경 파일 | ${baselineChangedMetrics.lines.total > 0 ? `\`${formatPct(baselineChangedMetrics.lines)}\`` : "`n/a`"} | ${currentChangedMetrics.lines.total > 0 ? `\`${formatPct(currentChangedMetrics.lines)}\`` : "`n/a`"} | ${baselineChangedMetrics.lines.total > 0 ? `\`${formatDelta(currentChangedMetrics.lines, baselineChangedMetrics.lines)}\`` : "`n/a`"} | ${currentChangedMetrics.lines.total > 0 && currentChangedMetrics.lines.pct < THRESHOLD ? "🚨 **80% 미만**" : currentChangedMetrics.lines.total > 0 ? "✅ 통과" : "ℹ️ 대상 없음"} |`,
    "",
    "### 커버리지 경고",
    "",
  ];

  if (warnings.length === 0) {
    lines.push("✅ 모든 도메인이 80% 이상입니다.");
  } else {
    lines.push("🚨 **80% 미만 항목**");
    lines.push(...warnings);
  }

  lines.push("");
  lines.push("### 스펙 스냅샷");
  lines.push("");
  lines.push(...renderPlatformSection(currentFrontend, baselineFrontend));
  lines.push(...renderPlatformSection(currentBackend, baselineBackend));
  lines.push(
    "<sub>이 스냅샷은 이번 PR에서 통과한 통합 테스트만 기준으로 생성됩니다. 실패하거나 skip된 테스트는 제외됩니다.</sub>",
    "",
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
  fs.writeFileSync(gateOutputPath, `${JSON.stringify(gate, null, 2)}\n`);
}

main();
