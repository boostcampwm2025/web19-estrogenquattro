#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const PLATFORM_LABELS = {
  frontend: "프론트엔드",
  backend: "백엔드",
};

const PLATFORM_ORDER = {
  frontend: 0,
  backend: 1,
};

const DEFAULT_THRESHOLD = 80;

const GROUP_RULES = {
  frontend: [
    {
      test: /(UserInfoModal\/tabs\/PetTab|\/PetGacha|\/PetCodex|\/PetCard|usePetSystem|\/pet)/i,
      domain: "펫",
      domainOrder: 10,
      featureRules: [
        { test: /PetGacha/i, feature: "가챠", featureOrder: 10 },
        {
          test: /PetCodex|PetCard|usePetSystem|PetTab/i,
          feature: "인벤토리·도감",
          featureOrder: 20,
        },
      ],
    },
    {
      test: /(TasksMenu|\/TaskItem|\/TaskList|\/TaskTimer|TasksMenuContent|mappers|timeFormat)/i,
      domain: "할 일",
      domainOrder: 20,
      featureRules: [
        { test: /TaskTimer|timeFormat/i, feature: "타이머", featureOrder: 10 },
        {
          test: /TaskItem|TaskList|TasksMenuContent|mappers/i,
          feature: "목록·생성",
          featureOrder: 20,
        },
      ],
    },
    {
      test: /(ActivityTab|FocusPanel|focus|focustime)/i,
      domain: "집중",
      domainOrder: 30,
      featureRules: [
        {
          test: /CalendarHeatmap|Heatmap|grassLevel|dateStats|dateUtils|useActivityData|StatsSection|FocusPanel/i,
          feature: "활동·통계",
          featureOrder: 10,
        },
      ],
    },
    {
      test: /Leaderboard/i,
      domain: "깃허브 활동",
      domainOrder: 40,
      featureRules: [{ test: /.*/, feature: "리더보드", featureOrder: 10 }],
    },
    {
      test: /MusicPlayer/i,
      domain: "음악",
      domainOrder: 50,
      featureRules: [{ test: /.*/, feature: "플레이어", featureOrder: 10 }],
    },
    {
      test: /Onboarding/i,
      domain: "온보딩",
      domainOrder: 60,
      featureRules: [{ test: /.*/, feature: "투어", featureOrder: 10 }],
    },
    {
      test: /Guestbook/i,
      domain: "게스트북",
      domainOrder: 70,
      featureRules: [{ test: /.*/, feature: "작성·목록", featureOrder: 10 }],
    },
    {
      test: /BugReport/i,
      domain: "버그 리포트",
      domainOrder: 80,
      featureRules: [{ test: /.*/, feature: "제보", featureOrder: 10 }],
    },
    {
      test: /ChannelSelect/i,
      domain: "채널",
      domainOrder: 90,
      featureRules: [{ test: /.*/, feature: "선택", featureOrder: 10 }],
    },
    {
      test: /ProfileTab|UserInfoModal/i,
      domain: "프로필",
      domainOrder: 100,
      featureRules: [{ test: /.*/, feature: "사용자 정보", featureOrder: 10 }],
    },
    {
      test: /\/game\//i,
      domain: "게임",
      domainOrder: 110,
      featureRules: [
        { test: /MapScene|MapManager/i, feature: "맵", featureOrder: 10 },
        {
          test: /Player|Pet|SocketManager|CameraController/i,
          feature: "플레이어·실시간",
          featureOrder: 20,
        },
        { test: /.*/, feature: "기타", featureOrder: 30 },
      ],
    },
  ],
  backend: [
    {
      test: /userpet|pet\./i,
      domain: "펫",
      domainOrder: 10,
      featureRules: [{ test: /.*/, feature: "UserPet", featureOrder: 10 }],
    },
    {
      test: /task/i,
      domain: "태스크",
      domainOrder: 20,
      featureRules: [{ test: /.*/, feature: "서비스", featureOrder: 10 }],
    },
    {
      test: /focustime/i,
      domain: "집중",
      domainOrder: 30,
      featureRules: [
        { test: /.*/, feature: "서비스·게이트웨이", featureOrder: 10 },
      ],
    },
    {
      test: /point|pointhistory|scheduler/i,
      domain: "포인트",
      domainOrder: 40,
      featureRules: [{ test: /.*/, feature: "정산·이력", featureOrder: 10 }],
    },
    {
      test: /github/i,
      domain: "깃허브 활동",
      domainOrder: 50,
      featureRules: [{ test: /.*/, feature: "동기화·지도", featureOrder: 10 }],
    },
    {
      test: /room|player|chat/i,
      domain: "방/플레이어",
      domainOrder: 60,
      featureRules: [{ test: /.*/, feature: "실시간", featureOrder: 10 }],
    },
    {
      test: /auth/i,
      domain: "인증",
      domainOrder: 70,
      featureRules: [{ test: /.*/, feature: "로그인·가드", featureOrder: 10 }],
    },
    {
      test: /guestbook/i,
      domain: "게스트북",
      domainOrder: 80,
      featureRules: [{ test: /.*/, feature: "서비스", featureOrder: 10 }],
    },
    {
      test: /bugreport/i,
      domain: "버그 리포트",
      domainOrder: 90,
      featureRules: [{ test: /.*/, feature: "서비스", featureOrder: 10 }],
    },
  ],
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readLines(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function normalizeRepoPath(filePath, platformKey) {
  const normalized = normalizePath(filePath);
  const marker = `${platformKey}/`;
  const markerIndex = normalized.lastIndexOf(marker);

  if (markerIndex !== -1) {
    return normalized.slice(markerIndex);
  }

  if (normalized.startsWith("src/") || normalized.startsWith("test/")) {
    return `${platformKey}/${normalized}`;
  }

  return normalized;
}

function isFrontendUnitTestFile(filePath) {
  return /^frontend\/src\/.*\.test\.(ts|tsx)$/.test(filePath);
}

function isBackendUnitTestFile(filePath) {
  return /^backend\/src\/.*\.spec\.ts$/.test(filePath);
}

function isCoverageTargetFile(filePath) {
  if (/^frontend\/src\/test\//.test(filePath)) {
    return false;
  }

  if (isFrontendUnitTestFile(filePath) || isBackendUnitTestFile(filePath)) {
    return false;
  }

  if (/\.d\.ts$/.test(filePath)) {
    return false;
  }

  return (
    /^frontend\/src\/.*\.(ts|tsx)$/.test(filePath) ||
    /^backend\/src\/.*\.ts$/.test(filePath)
  );
}

function classifyPath(filePath) {
  const normalized = normalizePath(filePath);
  const platformKey = normalized.startsWith("frontend/")
    ? "frontend"
    : normalized.startsWith("backend/")
      ? "backend"
      : null;

  if (!platformKey) {
    return null;
  }

  const rules = GROUP_RULES[platformKey];
  for (const rule of rules) {
    if (!rule.test.test(normalized)) {
      continue;
    }

    const featureRule =
      rule.featureRules.find((candidate) => candidate.test.test(normalized)) ??
      {
        feature: "기타",
        featureOrder: 999,
      };

    return {
      id: `${platformKey}:${rule.domain}:${featureRule.feature}`,
      platformKey,
      platformLabel: PLATFORM_LABELS[platformKey],
      domain: rule.domain,
      feature: featureRule.feature,
      domainOrder: rule.domainOrder,
      featureOrder: featureRule.featureOrder,
    };
  }

  return {
    id: `${platformKey}:기타:기타`,
    platformKey,
    platformLabel: PLATFORM_LABELS[platformKey],
    domain: "기타",
    feature: "기타",
    domainOrder: 999,
    featureOrder: 999,
  };
}

function getOrCreateGroup(groupMap, classification) {
  if (!groupMap.has(classification.id)) {
    groupMap.set(classification.id, {
      ...classification,
      specs: [],
      coverage: {
        covered: 0,
        total: 0,
      },
    });
  }
  return groupMap.get(classification.id);
}

function extractMetric(metric) {
  if (!metric || typeof metric.total !== "number") {
    return null;
  }
  return {
    covered: metric.covered,
    total: metric.total,
    pct: metric.total === 0 ? 100 : (metric.covered / metric.total) * 100,
  };
}

function buildCoverageData(platformKey, coverageSummaryPath) {
  const summary = readJson(coverageSummaryPath);
  if (!summary) {
    return {
      total: null,
      entries: [],
    };
  }

  const entries = [];
  for (const [filePath, stats] of Object.entries(summary)) {
    if (filePath === "total") {
      continue;
    }

    const repoPath = normalizeRepoPath(filePath, platformKey);
    if (!repoPath.startsWith(`${platformKey}/src/`)) {
      continue;
    }

    const metric = extractMetric(stats.lines);
    if (!metric) {
      continue;
    }

    entries.push({
      filePath: repoPath,
      ...metric,
    });
  }

  return {
    total: extractMetric(summary.total?.lines),
    entries,
  };
}

function formatSpecTitle(assertion) {
  const ancestors = (assertion.ancestorTitles ?? []).filter(Boolean);
  if (ancestors.length === 0) {
    return assertion.title;
  }

  const context = ancestors.slice(-2).join(" / ");
  return `${context}: ${assertion.title}`;
}

function buildTestData(platformKey, resultsPath) {
  const results = readJson(resultsPath);
  if (!results) {
    return {
      success: false,
      passedTests: 0,
      failedTests: 0,
      pendingTests: 0,
      suites: [],
      missing: true,
    };
  }

  return {
    success: Boolean(results.success),
    passedTests: results.numPassedTests ?? 0,
    failedTests: results.numFailedTests ?? 0,
    pendingTests: (results.numPendingTests ?? 0) + (results.numTodoTests ?? 0),
    suites: (results.testResults ?? []).map((suite) => ({
      filePath: normalizeRepoPath(suite.name, platformKey),
      assertions: suite.assertionResults ?? [],
    })),
    missing: false,
  };
}

function aggregateChangedFilesCoverage(changedFiles, coverageEntries) {
  const coverageByFile = new Map(
    coverageEntries.map((entry) => [normalizePath(entry.filePath), entry]),
  );

  const relevantFiles = changedFiles.filter((filePath) => isCoverageTargetFile(filePath));

  let covered = 0;
  let total = 0;
  let matchedFiles = 0;

  for (const filePath of relevantFiles) {
    const entry = coverageByFile.get(normalizePath(filePath));
    if (!entry) {
      continue;
    }
    covered += entry.covered;
    total += entry.total;
    matchedFiles += 1;
  }

  return {
    hasRelevantFiles: relevantFiles.length > 0 && matchedFiles > 0,
    matchedFiles,
    covered,
    total,
    pct: total === 0 ? null : (covered / total) * 100,
  };
}

function buildPlatformReport(platformKey, coverageSummaryPath, resultsPath) {
  const coverageData = buildCoverageData(platformKey, coverageSummaryPath);
  const testData = buildTestData(platformKey, resultsPath);
  const groupMap = new Map();

  for (const entry of coverageData.entries) {
    const classification = classifyPath(entry.filePath);
    if (!classification) {
      continue;
    }
    const group = getOrCreateGroup(groupMap, classification);
    group.coverage.covered += entry.covered;
    group.coverage.total += entry.total;
  }

  for (const suite of testData.suites) {
    const classification = classifyPath(suite.filePath);
    if (!classification) {
      continue;
    }
    const group = getOrCreateGroup(groupMap, classification);
    for (const assertion of suite.assertions) {
      if (assertion.status !== "passed") {
        continue;
      }
      group.specs.push(formatSpecTitle(assertion));
    }
  }

  const groups = Array.from(groupMap.values()).map((group) => ({
    ...group,
    specs: Array.from(new Set(group.specs)),
    coveragePct:
      group.coverage.total === 0
        ? null
        : (group.coverage.covered / group.coverage.total) * 100,
  }));

  return {
    platformKey,
    platformLabel: PLATFORM_LABELS[platformKey],
    totalCoverage: coverageData.total,
    testStatus: testData,
    groups,
    coverageEntries: coverageData.entries,
  };
}

function formatPct(value) {
  if (value === null || Number.isNaN(value)) {
    return "측정 실패";
  }
  return `${value.toFixed(1)}%`;
}

function formatStatus(pct, threshold) {
  if (pct === null || Number.isNaN(pct)) {
    return "⚠️ 측정 실패";
  }
  if (pct < threshold) {
    return "🚨 **80% 미만**";
  }
  return "✅ 통과";
}

function sortGroups(groups, threshold) {
  return [...groups].sort((left, right) => {
    const leftWarning = left.coveragePct !== null && left.coveragePct < threshold ? 0 : 1;
    const rightWarning =
      right.coveragePct !== null && right.coveragePct < threshold ? 0 : 1;

    return (
      leftWarning - rightWarning ||
      PLATFORM_ORDER[left.platformKey] - PLATFORM_ORDER[right.platformKey] ||
      left.domainOrder - right.domainOrder ||
      left.featureOrder - right.featureOrder ||
      left.domain.localeCompare(right.domain, "ko") ||
      left.feature.localeCompare(right.feature, "ko")
    );
  });
}

function renderTestStatus(platformReports) {
  const lines = ["### 테스트 상태", ""];

  for (const report of platformReports) {
    if (report.testStatus.missing) {
      lines.push(`- ⚠️ ${report.platformLabel} 단위 테스트 결과를 찾지 못했습니다.`);
      continue;
    }

    if (report.testStatus.success) {
      lines.push(
        `- ✅ ${report.platformLabel} 단위 테스트 통과 (${report.testStatus.passedTests}개 통과)`,
      );
      continue;
    }

    lines.push(
      `- 🚨 ${report.platformLabel} 단위 테스트 실패 (${report.testStatus.failedTests}개 실패 / ${report.testStatus.passedTests}개 통과)`,
    );
  }

  lines.push("");
  return lines;
}

function renderCoverageSummary(frontendReport, backendReport, changedFilesCoverage, threshold) {
  const changedCoverageValue = changedFilesCoverage.hasRelevantFiles
    ? formatPct(changedFilesCoverage.pct)
    : "대상 없음";

  const changedCoverageStatus = changedFilesCoverage.hasRelevantFiles
    ? formatStatus(changedFilesCoverage.pct, threshold)
    : "ℹ️ 대상 없음";

  return [
    "### 전체 커버리지 요약",
    "",
    "| 범위 | 커버리지 | 상태 |",
    "| --- | ---: | --- |",
    `| 프론트엔드 전체 | \`${formatPct(frontendReport.totalCoverage?.pct ?? null)}\` | ${formatStatus(frontendReport.totalCoverage?.pct ?? null, threshold)} |`,
    `| 백엔드 전체 | \`${formatPct(backendReport.totalCoverage?.pct ?? null)}\` | ${formatStatus(backendReport.totalCoverage?.pct ?? null, threshold)} |`,
    `| 변경 파일 | \`${changedCoverageValue}\` | ${changedCoverageStatus} |`,
    "",
  ];
}

function renderCoverageAlerts(groups, threshold) {
  const warningGroups = groups.filter(
    (group) => group.coveragePct !== null && group.coveragePct < threshold,
  );

  const lines = ["### 커버리지 경고", ""];

  if (groups.length === 0) {
    lines.push("이번 PR과 연결된 경고 대상 도메인이 없습니다.", "");
    return lines;
  }

  if (warningGroups.length === 0) {
    lines.push("✅ 모든 도메인이 `80% 이상`입니다.", "");
    return lines;
  }

  lines.push("🚨 **80% 미만 도메인/기능**");
  for (const group of warningGroups) {
    lines.push(
      `- \`${group.platformLabel} / ${group.domain} / ${group.feature}\` — \`${formatPct(group.coveragePct)}\``,
    );
  }
  lines.push("");
  return lines;
}

function renderGroup(group, threshold) {
  const isWarning = group.coveragePct !== null && group.coveragePct < threshold;
  const openTag = isWarning ? " open" : "";
  const status = isWarning
    ? "🚨 <strong>경고: 80% 미만</strong>"
    : "✅ 통과";
  const lines = [
    `<details${openTag}>`,
    `<summary><strong>${group.domain} / ${group.feature}</strong> — <code>${formatPct(group.coveragePct)}</code> — ${status}</summary>`,
    "",
  ];

  if (group.specs.length === 0) {
    lines.push("- 이번 PR에서 이 항목에 연결된 통과 스펙이 없습니다.", "");
  } else {
    for (const spec of group.specs) {
      lines.push(`- ${spec}`);
    }
    lines.push("");
  }

  lines.push("</details>", "");
  return lines;
}

function renderSpecSnapshot(groups, threshold) {
  const lines = ["### 스펙 스냅샷", ""];

  if (groups.length === 0) {
    lines.push("이번 PR에서 변경된 단위 테스트 도메인과 연결된 스펙이 없습니다.", "");
    return lines;
  }

  for (const platformKey of ["frontend", "backend"]) {
    const platformGroups = groups.filter((group) => group.platformKey === platformKey);
    if (platformGroups.length === 0) {
      continue;
    }

    lines.push(`#### ${PLATFORM_LABELS[platformKey]}`, "");
    for (const group of platformGroups) {
      lines.push(...renderGroup(group, threshold));
    }
  }

  return lines;
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const args = parseArgs(process.argv.slice(2));
const threshold = Number(args.threshold ?? DEFAULT_THRESHOLD);
const outputFile = args["output-file"];
const summaryFile = args["summary-file"];
const changedFiles = readLines(args["changed-files-file"]).map(normalizePath);

if (!outputFile || !summaryFile) {
  console.error("--output-file 과 --summary-file 은 필수입니다.");
  process.exit(1);
}

const frontendReport = buildPlatformReport(
  "frontend",
  args["frontend-summary"],
  args["frontend-results"],
);
const backendReport = buildPlatformReport(
  "backend",
  args["backend-summary"],
  args["backend-results"],
);

const allCoverageEntries = [
  ...frontendReport.coverageEntries,
  ...backendReport.coverageEntries,
];
const changedFilesCoverage = aggregateChangedFilesCoverage(
  changedFiles,
  allCoverageEntries,
);

const relevantGroupIds = new Set(
  changedFiles
    .filter(
      (filePath) =>
        isCoverageTargetFile(filePath) ||
        isFrontendUnitTestFile(filePath) ||
        isBackendUnitTestFile(filePath),
    )
    .map((filePath) => classifyPath(filePath))
    .filter(Boolean)
    .map((group) => group.id),
);

const allGroups = [...frontendReport.groups, ...backendReport.groups];
const snapshotGroups = sortGroups(
  allGroups.filter((group) => relevantGroupIds.has(group.id)),
  threshold,
);

const markdownLines = [
  "## 테스트 스펙 스냅샷",
  "",
  ...renderTestStatus([frontendReport, backendReport]),
  ...renderCoverageSummary(
    frontendReport,
    backendReport,
    changedFilesCoverage,
    threshold,
  ),
  ...renderCoverageAlerts(snapshotGroups, threshold),
  ...renderSpecSnapshot(snapshotGroups, threshold),
  "<sub>이 스냅샷은 이번 PR에서 통과한 테스트만 기준으로 생성됩니다. 실패하거나 skip된 테스트는 제외됩니다.</sub>",
  "",
];

const summary = {
  threshold,
  frontend: {
    success: frontendReport.testStatus.success,
    passedTests: frontendReport.testStatus.passedTests,
    failedTests: frontendReport.testStatus.failedTests,
    totalCoveragePct: frontendReport.totalCoverage?.pct ?? null,
  },
  backend: {
    success: backendReport.testStatus.success,
    passedTests: backendReport.testStatus.passedTests,
    failedTests: backendReport.testStatus.failedTests,
    totalCoveragePct: backendReport.totalCoverage?.pct ?? null,
  },
  changedFilesCoverage: {
    hasRelevantFiles: changedFilesCoverage.hasRelevantFiles,
    matchedFiles: changedFilesCoverage.matchedFiles,
    pct: changedFilesCoverage.pct,
    belowThreshold:
      changedFilesCoverage.hasRelevantFiles &&
      changedFilesCoverage.pct !== null &&
      changedFilesCoverage.pct < threshold,
  },
  warningGroups: snapshotGroups
    .filter((group) => group.coveragePct !== null && group.coveragePct < threshold)
    .map((group) => ({
      id: group.id,
      platform: group.platformLabel,
      domain: group.domain,
      feature: group.feature,
      coveragePct: group.coveragePct,
    })),
  hasRelevantGroups: snapshotGroups.length > 0,
};

ensureParentDirectory(outputFile);
ensureParentDirectory(summaryFile);
fs.writeFileSync(outputFile, `${markdownLines.join("\n").trim()}\n`);
fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
