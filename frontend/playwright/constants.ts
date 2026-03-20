import path from "node:path";

export const frontendBaseUrl =
  process.env.PLAYWRIGHT_FRONTEND_URL ?? "http://localhost:3000";
export const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://localhost:8080";
export const e2eSecret =
  process.env.PLAYWRIGHT_E2E_SECRET ?? "playwright-e2e-secret";
export const playwrightDbPath = path.resolve(
  process.cwd(),
  "../backend/data/jandi.playwright.sqlite",
);
export const authStatePath = path.join(
  process.cwd(),
  "playwright/.auth/user.json",
);
