import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerRow from "./PlayerRow";
import { POINT_TYPES } from "@/lib/api";
import { getGithubProfileUrl } from "@/utils/github";
import type { LeaderboardPlayer } from "./types";

const mockPlayer: LeaderboardPlayer = {
  playerId: 1,
  rank: 1,
  username: "testuser",
  profileImage: "https://example.com/avatar.png",
  points: 100,
};

describe("PlayerRow", () => {
  it("플레이어 이름을 표시한다", () => {
    render(<PlayerRow player={mockPlayer} />);

    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("플레이어 이름은 GitHub 프로필 링크로 렌더링된다", () => {
    render(<PlayerRow player={mockPlayer} />);

    const link = screen.getByRole("link", { name: "testuser" });
    expect(link).toHaveAttribute("href", getGithubProfileUrl("testuser"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("프로필 이미지와 점수는 링크가 아니다", () => {
    render(<PlayerRow player={mockPlayer} />);

    expect(screen.getByAltText("testuser").closest("a")).toBeNull();
    expect(screen.getByText("100").closest("a")).toBeNull();
  });

  it("사용자명이 비어 있으면 링크 없이 텍스트만 렌더링된다", () => {
    render(<PlayerRow player={{ ...mockPlayer, username: "   " }} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "   "),
    ).toBeInTheDocument();
  });

  it("1~3등은 No.N 형식으로 표시한다", () => {
    render(<PlayerRow player={mockPlayer} />);

    expect(screen.getByText("No.1")).toBeInTheDocument();
  });

  it("4등 이상은 숫자로 표시한다", () => {
    render(<PlayerRow player={{ ...mockPlayer, rank: 5 }} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("프로필 이미지가 있으면 img를 렌더링한다", () => {
    render(<PlayerRow player={mockPlayer} />);

    const img = screen.getByAltText("testuser");
    expect(img).toBeInTheDocument();
  });

  it("프로필 이미지가 없으면 이니셜을 표시한다", () => {
    render(<PlayerRow player={{ ...mockPlayer, profileImage: null }} />);

    expect(screen.getByText("te")).toBeInTheDocument();
  });

  it("집중 시간 탭에서는 시간 형식으로 표시한다", () => {
    render(
      <PlayerRow
        player={{ ...mockPlayer, points: 3661 }}
        selectedTab={POINT_TYPES.FOCUSED}
      />,
    );

    expect(screen.getByText("1h 1m 1s")).toBeInTheDocument();
  });

  it("전체 탭에서는 포인트 숫자를 표시한다", () => {
    render(<PlayerRow player={mockPlayer} selectedTab={POINT_TYPES.ALL} />);

    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("내 순위일 때 파란색 테두리 스타일이 적용된다", () => {
    const { container } = render(<PlayerRow player={mockPlayer} isMyRank />);

    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("border-blue-400");
  });

  it("일반 순위일 때 기본 스타일이 적용된다", () => {
    const { container } = render(<PlayerRow player={mockPlayer} />);

    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("border-amber-900/20");
  });
});
