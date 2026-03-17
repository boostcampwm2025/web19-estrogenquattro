import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@test": path.resolve(__dirname, "test"),
      "@backend": path.resolve(__dirname, "../backend/src"),
      typeorm: path.resolve(__dirname, "test/mocks/typeorm.ts"),
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts", "./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "test/unit/**/*.spec.ts"],
    environmentMatchGlobs: [
      ["src/**/*.test.{ts,tsx}", "jsdom"],
    ],
    coverage: {
      reporter: ["json-summary", "lcov", "text-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/app/_components/FocusPanel/FocusPanel.tsx",
        "src/app/_components/LeaderboardModal/**/*.ts",
        "src/app/_components/LeaderboardModal/**/*.tsx",
        "src/app/_components/MusicPlayer/**/*.ts",
        "src/app/_components/MusicPlayer/**/*.tsx",
        "src/app/_components/TasksMenu/**/*.ts",
        "src/app/_components/TasksMenu/**/*.tsx",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/**/*.ts",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/**/*.tsx",
        "src/app/_components/UserInfoModal/tabs/PetTab/**/*.ts",
        "src/app/_components/UserInfoModal/tabs/PetTab/**/*.tsx",
        "src/utils/textBytes.ts",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "test/**",
        "src/test/**",
        "src/**/*.d.ts",
        "src/app/_components/LeaderboardModal/index.tsx",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/index.ts",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/types/**",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/constants/**",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/lib/statCards.ts",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/components/CalendarHeatmap/HeatmapInfo.tsx",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/components/CalendarHeatmap/HeatmapTooltip.tsx",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/components/DetailSection/**",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/components/StatsSection/GrassCard.tsx",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/components/StatsSection/Mascot.tsx",
        "src/app/_components/UserInfoModal/tabs/ActivityTab/components/TaskSection/**",
        "src/app/_components/UserInfoModal/tabs/PetTab/components/LicenseInfo.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
