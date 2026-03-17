import { defineConfig, devices } from "@playwright/test";
import {
  authStatePath,
  backendBaseUrl,
  e2eSecret,
  frontendBaseUrl,
  playwrightDbPath,
} from "./playwright/constants";

function getPort(url: string): string {
  const parsed = new URL(url);
  if (parsed.port) {
    return parsed.port;
  }

  return parsed.protocol === "https:" ? "443" : "80";
}

const frontendPort = getPort(frontendBaseUrl);
const backendPort = getPort(backendBaseUrl);

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
    baseURL: frontendBaseUrl,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `rm -f '${playwrightDbPath}' && pnpm start:playwright`,
      cwd: "../backend",
      url: `${backendBaseUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: backendPort,
        FRONTEND_URL: frontendBaseUrl,
        GITHUB_CLIENT_ID:
          process.env.GITHUB_CLIENT_ID ?? "playwright-client-id",
        GITHUB_CLIENT_SECRET:
          process.env.GITHUB_CLIENT_SECRET ?? "playwright-client-secret",
        GITHUB_CALLBACK_URL: `${backendBaseUrl}/auth/github/callback`,
        JWT_SECRET:
          process.env.JWT_SECRET ??
          "playwright-jwt-secret-key-must-be-at-least-32",
        DB_PATH: playwrightDbPath,
        DB_SYNCHRONIZE: "true",
        PLAYWRIGHT_TEST_MODE: "true",
        PLAYWRIGHT_E2E_SECRET: e2eSecret,
      },
    },
    {
      command: "pnpm dev",
      cwd: ".",
      url: `${frontendBaseUrl}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: frontendPort,
        NEXT_PUBLIC_API_URL: backendBaseUrl,
        NEXT_PUBLIC_SOCKET_URL: backendBaseUrl,
      },
    },
  ],
});
