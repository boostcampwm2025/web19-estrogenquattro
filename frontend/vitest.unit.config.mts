import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unitCoverageExcludes = [
  "src/game/**",
  "src/app/login/**",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/auth/callback/page.tsx",
  "src/app/_components/Providers.tsx",
  "src/_components/Map.tsx",
  "src/_components/AuthGuard.tsx",
  "src/_components/ClientOnly.tsx",
  "src/_components/ConnectionLostOverlay.tsx",
  "src/i18n/**",
  "src/lib/api/**",
  "src/lib/diagnostics.ts",
  "src/app/_components/OnboardingTour/OnboardingTour.tsx",
  "src/app/_components/BugReportModal/BugReportModal.tsx",
  "src/app/_components/ChannelSelectModal/ChannelSelectModal.tsx",
  "src/app/_components/GuestbookModal/GuestbookModal.tsx",
  "src/app/_components/UserInfoModal/index.tsx",
  "src/app/_components/UserInfoModal/tabs/ProfileTab/ProfileTab.tsx",
  "src/app/_components/UserInfoModal/tabs/ActivityTab/components/DetailSection/GitEventDetail.tsx",
  "src/app/_components/OnboardingTour/DialogBox.tsx",
  "src/app/_components/OnboardingTour/OnboardingHighlight.tsx",
  "src/_components/ui/ProgressBar.tsx",
  "src/_components/ui/ContributionList.tsx",
  "src/_components/ui/checkbox.tsx",
  "src/app/_components/UserInfoButton.tsx",
  "src/app/_components/BugReportButton.tsx",
  "src/app/_components/GuestbookButton.tsx",
  "src/app/_components/LeaderboardButton.tsx",
  "src/app/_components/ChannelSelectButton.tsx",
  "src/app/_components/DynamicTitle.tsx",
  "src/hooks/useModalClose.ts",
  "src/app/_components/UserInfoModal/tabs/ActivityTab/components/TaskSection/TaskSection.tsx",
  "src/app/_components/UserInfoModal/tabs/ActivityTab/components/StatsSection/Mascot.tsx",
  "src/app/_components/UserInfoModal/tabs/ActivityTab/components/StatsSection/GrassCard.tsx",
  "src/app/_components/Toast.tsx",
  "src/app/_components/BugReportModal/index.tsx",
  "src/app/_components/ChannelSelectModal/index.tsx",
  "src/app/_components/FocusPanel/index.tsx",
  "src/app/_components/LeaderboardModal/index.tsx",
  "src/app/_components/OnboardingTour/index.ts",
  "src/app/_components/UserInfoModal/tabs/ActivityTab/index.ts",
  "src/app/_components/UserInfoModal/tabs/ProfileTab/index.ts",
  "src/app/_components/GuestbookModal/GuestbookEntryCard.tsx",
  "src/app/_components/GuestbookModal/GuestbookInputForm.tsx",
  "src/app/_components/UserInfoModal/tabs/ActivityTab/components/DetailSection/DetailSection.tsx",
  "src/app/_components/UserInfoModal/tabs/PetTab/components/LicenseInfo.tsx",
];

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
    include: [
      "src/**/*.test.{ts,tsx}",
      "test/unit/**/*.spec.ts",
      "test/integration/tasks.api.spec.ts",
      "test/integration/focustime-store.spec.ts",
      "test/integration/socket-manager.spec.ts",
    ],
    environmentMatchGlobs: [["src/**/*.test.{ts,tsx}", "jsdom"]],
    coverage: {
      reporter: ["json-summary", "lcov", "text-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "test/**",
        "src/test/**",
        "src/**/*.d.ts",
        ...unitCoverageExcludes,
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
