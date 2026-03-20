import { describe, expect, it } from "vitest";
import { getGithubAvatarUrl, getGithubProfileUrl } from "./github";

describe("github utils", () => {
  it("GitHub 아바타 URL을 생성한다", () => {
    expect(getGithubAvatarUrl("octocat")).toBe(
      "https://github.com/octocat.png",
    );
  });

  it("GitHub 프로필 URL을 생성한다", () => {
    expect(getGithubProfileUrl("octocat")).toBe("https://github.com/octocat");
  });
});
