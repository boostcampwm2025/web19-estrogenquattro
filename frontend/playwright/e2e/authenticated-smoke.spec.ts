import { expect, test } from "@playwright/test";

test("인증 setup 이후 메인 페이지가 로그인으로 튕기지 않고 방명록 버튼을 렌더링한다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#guestbook-button")).toBeVisible();
  await expect(page).not.toHaveURL(/\/login\/?$/);
});

test("인증 상태에서 게임 캔버스와 소켓 연결이 안정적으로 유지된다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("#game-container canvas")).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(11_000);

  await expect(page.locator("#game-container canvas")).toBeVisible();
  await expect(
    page.getByText(/Connection to server lost|서버와의 연결이 끊어졌습니다\./),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
});
