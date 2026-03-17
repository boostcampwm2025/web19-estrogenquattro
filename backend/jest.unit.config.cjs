const packageJson = require("./package.json");

module.exports = {
  ...packageJson.jest,
  collectCoverageFrom: [
    "app.controller.ts",
    "auth/user.store.ts",
    "chat/chat.gateway.ts",
    "focustime/focustime.service.ts",
    "player/player.service.ts",
    "point/point.service.ts",
    "pointhistory/point-history.service.ts",
    "task/task.service.ts",
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
