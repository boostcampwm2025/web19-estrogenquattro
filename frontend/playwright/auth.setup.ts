import { expect, request, test as setup } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { authStatePath, backendBaseUrl, e2eSecret } from "./constants";

setup("seed authenticated playwright session", async () => {
  await fs.mkdir(path.dirname(authStatePath), { recursive: true });

  const apiContext = await request.newContext({
    baseURL: backendBaseUrl,
    extraHTTPHeaders: {
      "x-e2e-secret": e2eSecret,
    },
  });

  const loginResponse = await apiContext.post("/auth/test-login", {
    data: {
      socialId: 56401,
      username: "playwright-user",
    },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const meResponse = await apiContext.get("/auth/me");
  expect(meResponse.ok()).toBeTruthy();

  await apiContext.storageState({ path: authStatePath });
  await apiContext.dispose();
});
