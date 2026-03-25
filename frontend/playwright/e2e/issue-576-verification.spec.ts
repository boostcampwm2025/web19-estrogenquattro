import { expect, test } from "@playwright/test";

test("리더보드는 nickname으로 GitHub 프로필 링크를 연다", async ({
  page,
  context,
}) => {
  await page.route("**/api/points/ranks**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          playerId: 999,
          nickname: "octocat",
          totalPoints: 120,
          rank: 1,
        },
      ]),
    });
  });

  await page.route("**/api/history-ranks**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          playerId: 999,
          nickname: "octocat",
          count: 3600,
          rank: 1,
        },
      ]),
    });
  });

  await page.goto("/");
  await page.click("#leaderboard-button");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const displayLink = dialog.getByRole("link", { name: "octocat" });
  await expect(displayLink).toHaveAttribute(
    "href",
    "https://github.com/octocat",
  );

  const popupPromise = page.waitForEvent("popup");
  await displayLink.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveURL("https://github.com/octocat");
  await popup.close();

  await displayLink.focus();
  await expect(displayLink).toBeFocused();

  const profileImage = dialog.getByAltText("octocat");
  await expect(profileImage.locator("xpath=ancestor::a[1]")).toHaveCount(0);

  const pageCountBeforeAvatarClick = context.pages().length;
  await profileImage.click();
  await page.waitForTimeout(300);
  expect(context.pages()).toHaveLength(pageCountBeforeAvatarClick);

  const myRankLink = dialog.getByRole("link", { name: "playwright-user" });
  await expect(myRankLink).toHaveAttribute(
    "href",
    "https://github.com/playwright-user",
  );

  await page.getByRole("button", { name: /집중 시간|Focus Time/i }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1h")).toBeVisible();
});
