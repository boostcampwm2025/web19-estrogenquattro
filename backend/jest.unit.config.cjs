const packageJson = require("./package.json");

module.exports = {
  ...packageJson.jest,
  collectCoverageFrom: ["**/*.ts", "!**/*.spec.ts", "!test/**"],
  coverageReporters: ["json-summary", "lcov", "text-summary"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
