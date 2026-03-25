const packageJson = require("./package.json");

module.exports = {
  ...packageJson.jest,
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.spec.ts",
    "!test/**",
    "!main.ts",
    "!config/**",
    "!database/migrations/**",
    "!**/*.module.ts",
    "!**/*.controller.ts",
    "!**/*.gateway.ts",
    "!**/*.guard.ts",
    "!**/*.strategy.ts",
    "!**/*.decorator.ts",
    "!**/*.pipe.ts",
    "!**/dto/**",
    "!**/entities/**",
    "!github/github.poll-service.ts",
    "!database/write-lock.service.ts",
    "!database/data-source.ts",
  ],
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
