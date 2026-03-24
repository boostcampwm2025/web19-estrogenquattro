import fs from "node:fs";
import path from "node:path";

import {
  classifyCoverageFile,
  classifyTest,
  platformLabel,
  toRepoRelativePath,
} from "./domain-taxonomy.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    args[key.replace(/^--/, "")] = value;
  }
  return args;
}

function ensureMetric(metric = {}) {
  return {
    total: Number(metric.total ?? 0),
    covered: Number(metric.covered ?? 0),
    pct: Number(metric.pct ?? 0),
  };
}

function cloneAccumulator() {
  return {
    lines: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
  };
}

function addMetric(accumulator, entry) {
  for (const key of Object.keys(accumulator)) {
    accumulator[key].total += Number(entry[key]?.total ?? 0);
    accumulator[key].covered += Number(entry[key]?.covered ?? 0);
  }
}

function finalizeMetric(metric) {
  return {
    total: metric.total,
    covered: metric.covered,
    pct: metric.total === 0 ? 100 : Number(((metric.covered / metric.total) * 100).toFixed(2)),
  };
}

function finalizeAccumulator(accumulator) {
  return Object.fromEntries(
    Object.entries(accumulator).map(([key, value]) => [key, finalizeMetric(value)]),
  );
}

function normalizeCoverageEntries(coverageSummary, platform, repoRoot) {
  const files = [];
  const domainMap = new Map();

  for (const [rawPath, metrics] of Object.entries(coverageSummary)) {
    if (rawPath === "total") continue;

    const relativePath = toRepoRelativePath(rawPath, repoRoot);
    const classification = classifyCoverageFile(platform, relativePath);
    const normalizedMetrics = {
      lines: ensureMetric(metrics.lines),
      statements: ensureMetric(metrics.statements),
      functions: ensureMetric(metrics.functions),
      branches: ensureMetric(metrics.branches),
    };

    files.push({
      path: relativePath,
      ...classification,
      ...normalizedMetrics,
    });

    const domainEntry =
      domainMap.get(classification.domainKey) ??
      {
        domainKey: classification.domainKey,
        domainLabel: classification.domainLabel,
        metrics: cloneAccumulator(),
      };
    addMetric(domainEntry.metrics, normalizedMetrics);
    domainMap.set(classification.domainKey, domainEntry);
  }

  const domains = [...domainMap.values()]
    .map((entry) => ({
      domainKey: entry.domainKey,
      domainLabel: entry.domainLabel,
      ...finalizeAccumulator(entry.metrics),
    }))
    .sort((left, right) => left.domainLabel.localeCompare(right.domainLabel, "ko"));

  return { files: files.sort((left, right) => left.path.localeCompare(right.path)), domains };
}

function normalizeTestResults(testResults, platform, repoRoot) {
  const tests = [];

  for (const suite of testResults.testResults ?? []) {
    const relativePath = toRepoRelativePath(suite.name, repoRoot);
    const classification = classifyTest(platform, relativePath);

    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status !== "passed") continue;
      tests.push({
        path: relativePath,
        title: assertion.title,
        fullName:
          assertion.fullName ??
          [...(assertion.ancestorTitles ?? []), assertion.title].join(" "),
        ...classification,
      });
    }
  }

  return tests.sort((left, right) => left.fullName.localeCompare(right.fullName, "ko"));
}

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = process.cwd();
  const outputPath = path.resolve(repoRoot, args.output);
  const coverageSummary = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, args.coverage), "utf8"),
  );
  const testResults = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, args.results), "utf8"),
  );

  const { files, domains } = normalizeCoverageEntries(
    coverageSummary,
    args.platform,
    repoRoot,
  );
  const tests = normalizeTestResults(testResults, args.platform, repoRoot);

  const report = {
    kind: "integration-coverage-report",
    platform: args.platform,
    platformLabel: platformLabel(args.platform),
    generatedAt: new Date().toISOString(),
    totals: {
      lines: ensureMetric(coverageSummary.total.lines),
      statements: ensureMetric(coverageSummary.total.statements),
      functions: ensureMetric(coverageSummary.total.functions),
      branches: ensureMetric(coverageSummary.total.branches),
    },
    files,
    domains,
    tests,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

main();
