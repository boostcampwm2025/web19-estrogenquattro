import {
  expect,
  request,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { backendBaseUrl, e2eSecret } from "../constants";

async function seedUserState(
  browser: Browser,
  user: { socialId: number; username: string; nickname: string },
): Promise<BrowserContext> {
  const apiContext = await request.newContext({
    baseURL: backendBaseUrl,
    extraHTTPHeaders: {
      "x-e2e-secret": e2eSecret,
    },
  });

  const loginResponse = await apiContext.post("/auth/test-login", {
    data: user,
  });
  expect(loginResponse.ok()).toBeTruthy();

  const storageState = await apiContext.storageState();
  await apiContext.dispose();

  return browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState,
  });
}

async function preparePage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("onboarding_completed", "true");
    window.localStorage.setItem("i18nextLng", "ko");
  });

  await page.goto("/");
  await expect(page.locator("#channel-select-button")).toHaveText(/CH\.\d+/, {
    timeout: 15_000,
  });
  await expect(page.locator("#game-container canvas")).toBeVisible({
    timeout: 15_000,
  });
}

async function joinRoom(page: Page, roomNumber: string): Promise<void> {
  const channelButton = page.locator("#channel-select-button");
  if ((await channelButton.textContent())?.trim() === `CH.${roomNumber}`) {
    return;
  }

  await channelButton.click();
  const modal = page.locator('[aria-labelledby="channel-select-title"]');
  await expect(modal).toBeVisible();

  const actionButton = modal
    .getByText(`CH.${roomNumber}`, { exact: true })
    .locator("xpath=ancestor::div[2]//button[last()]");
  await actionButton.click();
  await expect(modal).toBeHidden();
  await expect(channelButton).toHaveText(`CH.${roomNumber}`);
}

async function waitForRemotePlayerCount(page: Page, expectedCount: number) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.getElementById("game-container");
          if (!el) return -1;

          const fiberKey = Object.keys(el).find((key) =>
            key.startsWith("__reactFiber$"),
          );
          if (!fiberKey) return -2;

          let fiber: unknown = (el as Record<string, unknown>)[fiberKey];
          while (
            fiber &&
            typeof fiber === "object" &&
            "type" in fiber &&
            typeof (fiber as { type: unknown }).type === "string"
          ) {
            fiber = (fiber as { return: unknown }).return;
          }

          const mapFiber = fiber as {
            memoizedState?: { memoizedState?: { current?: unknown }; next?: unknown };
          } | null;
          const game =
            mapFiber?.memoizedState?.memoizedState &&
            typeof mapFiber.memoizedState.memoizedState === "object"
              ? (
                  mapFiber.memoizedState.memoizedState as {
                    current?: {
                      scene?: { scenes?: Array<Record<string, unknown>> };
                    } | null;
                  }
                ).current
              : null;

          const scene = game?.scene?.scenes?.[0];
          if (!scene) return -3;

          const otherPlayers = scene.socketManager?.otherPlayers;
          if (!otherPlayers || typeof otherPlayers.size !== "number") return -4;

          return otherPlayers.size;
        }),
      {
        timeout: 15_000,
      },
    )
    .toBe(expectedCount);
}

test("issue 574 regression: 다른 사람 프로필 로딩 중 현재 사용자 프로필이 노출되지 않는다", async ({
  browser,
  page,
}) => {
  const otherContext = await seedUserState(browser, {
    socialId: 56402,
    username: "issue-574-other-user",
    nickname: "Issue 574 Other User",
  });
  const otherPage = await otherContext.newPage();

  try {
    await preparePage(page);
    await preparePage(otherPage);

    const roomNumber =
      (await page.locator("#channel-select-button").textContent())
        ?.trim()
        .replace("CH.", "") ?? "1";

    await joinRoom(otherPage, roomNumber);
    await waitForRemotePlayerCount(page, 1);

    await page.route("**/api/github/users/issue-574-other-user", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          login: "issue-574-other-user",
          id: 987654321,
          avatar_url: "https://avatars.githubusercontent.com/u/987654321?v=4",
          html_url: "https://github.com/issue-574-other-user",
          followers: 12,
          following: 34,
          name: "Issue 574 Other User",
          bio: "playwright repro",
        }),
      });
    });

    await page.route(
      "**/api/github/users/issue-574-other-user/follow-status",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ isFollowing: false }),
        });
      },
    );

    await page.evaluate(() => {
      const el = document.getElementById("game-container");
      if (!el) {
        throw new Error("game-container not found");
      }

      const fiberKey = Object.keys(el).find((key) =>
        key.startsWith("__reactFiber$"),
      );
      if (!fiberKey) {
        throw new Error("react fiber key not found");
      }

      let fiber: unknown = (el as Record<string, unknown>)[fiberKey];
      while (
        fiber &&
        typeof fiber === "object" &&
        "type" in fiber &&
        typeof (fiber as { type: unknown }).type === "string"
      ) {
        fiber = (fiber as { return: unknown }).return;
      }

      const mapFiber = fiber as {
        memoizedState?: { memoizedState?: { current?: unknown } };
      } | null;
      const game = (
        mapFiber?.memoizedState?.memoizedState as {
          current?: {
            canvas: HTMLCanvasElement;
            scene: { scenes: Array<Record<string, unknown>> };
          } | null;
        }
      )?.current;
      const scene = game?.scene.scenes[0];
      const otherPlayers = scene?.socketManager?.otherPlayers;

      if (!otherPlayers || otherPlayers.size === 0) {
        throw new Error("remote player not found");
      }

      const remotePlayer = Array.from(otherPlayers.values())[0] as {
        getContainer: () => {
          emit: (
            eventName: string,
            pointer: { event: { clientX: number; clientY: number } },
            lx: number,
            ly: number,
            eventData: { stopPropagation: () => void },
          ) => void;
        };
      };
      const canvasRect = game.canvas.getBoundingClientRect();
      const clientX = canvasRect.left + canvasRect.width * 0.6;
      const clientY = canvasRect.top + canvasRect.height * 0.6;

      remotePlayer.getContainer().emit(
        "pointerdown",
        {
          event: {
            clientX,
            clientY,
          },
        },
        0,
        0,
        {
          stopPropagation() {},
        },
      );
    });

    const modal = page.locator("#user-info-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("issue-574-other-user")).toBeVisible();

    await modal.getByRole("button", { name: "프로필", exact: true }).click();
    await expect(modal.getByText("프로필 로딩 중...")).toBeVisible();
    await expect(
      modal.locator('img[src="https://github.com/playwright-user.png"]'),
    ).toHaveCount(0);
    await expect(
      modal.locator('img[src="https://avatars.githubusercontent.com/u/987654321?v=4"]'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      modal.getByRole("button", { name: "팔로우", exact: true }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
