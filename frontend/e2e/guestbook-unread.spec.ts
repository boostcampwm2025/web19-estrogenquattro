import {
  expect,
  request as playwrightRequest,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type StorageState,
} from "@playwright/test";
import { backendUrl, e2eSecret, frontendUrl } from "./testEnv";

async function createSession(
  socialId: number,
  username: string,
): Promise<StorageState> {
  const api = await playwrightRequest.newContext({ baseURL: backendUrl });

  const response = await api.post("/auth/test-login", {
    headers: {
      "x-e2e-secret": e2eSecret,
    },
    data: {
      socialId,
      username,
      nickname: username,
    },
  });

  expect(response.ok()).toBeTruthy();

  const storageState = await api.storageState();
  await api.dispose();
  return storageState;
}

async function createGuestbookEntry(
  socialId: number,
  username: string,
  content: string,
): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: backendUrl });

  const loginResponse = await api.post("/auth/test-login", {
    headers: {
      "x-e2e-secret": e2eSecret,
    },
    data: {
      socialId,
      username,
      nickname: username,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const createResponse = await api.post("/api/guestbooks", {
    data: { content },
  });
  expect(createResponse.ok()).toBeTruthy();

  await api.dispose();
}

async function openAuthenticatedPage(
  browser: Browser,
  storageState: StorageState,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("onboarding_completed", "true");
  });
  const page = await context.newPage();

  await page.goto(frontendUrl, { waitUntil: "networkidle" });
  await expect(page.locator("#guestbook-button")).toBeVisible();

  return { context, page };
}

test("same-account unread state is shared across multiple browser sessions", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const baseId = Date.now();
  const readerSocialId = baseId;
  const readerUsername = `guestbook-reader-${baseId}`;
  const readerSessionA = await createSession(readerSocialId, readerUsername);
  const readerSessionB = await createSession(readerSocialId, readerUsername);

  await createGuestbookEntry(
    baseId + 1,
    `guestbook-writer-one-${baseId}`,
    "first guestbook",
  );

  const firstReader = await openAuthenticatedPage(browser, readerSessionA);
  const secondReader = await openAuthenticatedPage(browser, readerSessionB);

  await expect(
    firstReader.page.locator('[data-testid="guestbook-unread-badge"]'),
  ).toBeVisible();
  await expect(
    secondReader.page.locator('[data-testid="guestbook-unread-badge"]'),
  ).toBeVisible();

  await Promise.all([
    firstReader.page.waitForResponse(
      (response) =>
        response.url() === `${backendUrl}/api/guestbooks/read` &&
        response.request().method() === "POST" &&
        response.status() === 200,
      {
        timeout: 15_000,
      },
    ),
    firstReader.page.locator("#guestbook-button").evaluate((element) => {
      (element as HTMLButtonElement).click();
    }),
  ]);
  await firstReader.page.reload({ waitUntil: "networkidle" });
  await expect
    .poll(
      () =>
        firstReader.page
          .locator('[data-testid="guestbook-unread-badge"]')
          .count(),
      {
        timeout: 10_000,
      },
    )
    .toBe(0);

  await secondReader.page.reload({ waitUntil: "networkidle" });
  await expect
    .poll(
      () =>
        secondReader.page
          .locator('[data-testid="guestbook-unread-badge"]')
          .count(),
      {
        timeout: 10_000,
      },
    )
    .toBe(0);

  await createGuestbookEntry(
    baseId + 2,
    `guestbook-writer-two-${baseId}`,
    "second guestbook",
  );

  await secondReader.page.reload({ waitUntil: "networkidle" });
  await expect(
    secondReader.page.locator('[data-testid="guestbook-unread-badge"]'),
  ).toBeVisible();

  await firstReader.context.close();
  await secondReader.context.close();
});
