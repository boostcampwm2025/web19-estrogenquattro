import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfileTab from "./ProfileTab";
import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";
import { useGithubUser, useFollowStatus } from "@/lib/api/hooks/useGithub";
import { useFollowMutation } from "@/lib/api/hooks/useFollowMutation";

vi.mock("@/stores/useModalStore");
vi.mock("@/stores/authStore");
vi.mock("@/lib/api/hooks/useGithub");
vi.mock("@/lib/api/hooks/useFollowMutation");

describe("ProfileTab", () => {
  const logout = vi.fn();
  const handleFollowToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const state = {
        user: {
          githubId: "56401",
          username: "playwright-user",
          avatarUrl: "https://github.com/playwright-user.png",
          playerId: 1,
        },
        isLoading: false,
        isAuthenticated: true,
        fetchUser: vi.fn(),
        logout,
      };

      return selector ? selector(state) : state;
    });

    vi.mocked(useModalStore).mockImplementation((selector) => {
      const state = {
        activeModal: "userInfo" as const,
        userInfoPayload: {
          playerId: 2,
          username: "issue-574-other-user",
        },
        openModal: vi.fn(),
        closeModal: vi.fn(),
        toggleModal: vi.fn(),
      };

      return selector(state);
    });

    vi.mocked(useGithubUser).mockReturnValue({
      user: undefined,
      isLoading: false,
      error: null,
    });

    vi.mocked(useFollowStatus).mockReturnValue({
      isFollowing: false,
      isLoading: false,
      error: null,
    });

    vi.mocked(useFollowMutation).mockReturnValue({
      handleFollowToggle,
      isSubmitting: false,
    });
  });

  it("타인 프로필 로딩 중에는 현재 사용자 fallback 대신 로딩 UI만 표시한다", () => {
    vi.mocked(useGithubUser).mockReturnValue({
      user: undefined,
      isLoading: true,
      error: null,
    });

    render(<ProfileTab />);

    expect(screen.getByText("프로필 로딩 중...")).toBeInTheDocument();
    expect(
      screen.queryByAltText("playwright-user의 프로필"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("playwright-user")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "로그아웃" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("팔로워")).not.toBeInTheDocument();
  });

  it("내 프로필일 때는 기존 avatar와 로그아웃 버튼을 유지한다", () => {
    vi.mocked(useModalStore).mockImplementation((selector) => {
      const state = {
        activeModal: "userInfo" as const,
        userInfoPayload: {
          playerId: 1,
          username: "playwright-user",
        },
        openModal: vi.fn(),
        closeModal: vi.fn(),
        toggleModal: vi.fn(),
      };

      return selector(state);
    });

    render(<ProfileTab />);

    expect(screen.getByAltText("playwright-user의 프로필")).toHaveAttribute(
      "src",
      "https://github.com/playwright-user.png",
    );
    expect(
      screen.getByRole("button", { name: "로그아웃" }),
    ).toBeInTheDocument();
  });

  it("타인 프로필 로딩 완료 후에는 대상 사용자 정보와 팔로우 버튼을 표시한다", () => {
    vi.mocked(useGithubUser).mockReturnValue({
      user: {
        login: "issue-574-other-user",
        id: 987654321,
        avatar_url: "https://avatars.githubusercontent.com/u/987654321?v=4",
        html_url: "https://github.com/issue-574-other-user",
        followers: 12,
        following: 34,
        name: "Issue 574 Other User",
        bio: "playwright repro",
      },
      isLoading: false,
      error: null,
    });

    render(<ProfileTab />);

    expect(
      screen.getByAltText("issue-574-other-user의 프로필"),
    ).toHaveAttribute(
      "src",
      "https://avatars.githubusercontent.com/u/987654321?v=4",
    );
    expect(screen.getByText("issue-574-other-user")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팔로우" })).toBeInTheDocument();
  });
});
