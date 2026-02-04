import { describe, it, expect, vi } from "vitest";
import {
  getRankTextColor,
  getRankDisplay,
  calculateSeasonRemaining,
  formatTime,
  formatSecondsToHMS,
  toLeaderboardPlayerFromTotal,
  toLeaderboardPlayerFromActivity,
  toMyRankPlayerFromTotal,
  toMyRankPlayerFromActivity,
} from "./utils";

describe("utils", () => {
  describe("getRankTextColor", () => {
    it("1등은 금색을 반환한다", () => {
      expect(getRankTextColor(1)).toBe("text-yellow-500");
    });

    it("2등은 은색을 반환한다", () => {
      expect(getRankTextColor(2)).toBe("text-gray-400");
    });

    it("3등은 동색을 반환한다", () => {
      expect(getRankTextColor(3)).toBe("text-[#CD7F32]");
    });

    it("4등 이상은 기본색을 반환한다", () => {
      expect(getRankTextColor(4)).toBe("text-amber-900");
      expect(getRankTextColor(10)).toBe("text-amber-900");
    });
  });

  describe("getRankDisplay", () => {
    it("1~3등은 No.N 형식으로 반환한다", () => {
      expect(getRankDisplay(1)).toBe("No.1");
      expect(getRankDisplay(2)).toBe("No.2");
      expect(getRankDisplay(3)).toBe("No.3");
    });

    it("4등 이상은 숫자를 그대로 반환한다", () => {
      expect(getRankDisplay(4)).toBe(4);
      expect(getRankDisplay(100)).toBe(100);
    });
  });

  describe("calculateSeasonRemaining", () => {
    it("종료 시간이 지났으면 모두 0을 반환한다", () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();
      expect(calculateSeasonRemaining(pastTime)).toEqual({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      });
    });

    it("남은 시간을 일/시/분/초로 분해한다", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-02-03T00:00:00Z"));
        // 1일 2시간 3분 4초 뒤
        const endTime = new Date("2026-02-04T02:03:04Z").toISOString();
        const result = calculateSeasonRemaining(endTime);
        expect(result).toEqual({
          days: 1,
          hours: 2,
          minutes: 3,
          seconds: 4,
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("formatTime", () => {
    it("한 자리 숫자를 두 자리로 패딩한다", () => {
      expect(formatTime(0)).toBe("00");
      expect(formatTime(5)).toBe("05");
    });

    it("두 자리 숫자는 그대로 반환한다", () => {
      expect(formatTime(10)).toBe("10");
      expect(formatTime(59)).toBe("59");
    });
  });

  describe("formatSecondsToHMS", () => {
    it("0초는 '0s'를 반환한다", () => {
      expect(formatSecondsToHMS(0)).toBe("0s");
    });

    it("초만 있을 때 's' 형식으로 반환한다", () => {
      expect(formatSecondsToHMS(45)).toBe("45s");
    });

    it("분과 초가 있을 때 'm s' 형식으로 반환한다", () => {
      expect(formatSecondsToHMS(125)).toBe("2m 5s");
    });

    it("시/분/초 모두 있을 때 'h m s' 형식으로 반환한다", () => {
      expect(formatSecondsToHMS(3661)).toBe("1h 1m 1s");
    });

    it("정확히 1시간은 '1h'를 반환한다", () => {
      expect(formatSecondsToHMS(3600)).toBe("1h");
    });
  });

  describe("toLeaderboardPlayerFromTotal", () => {
    it("TotalRankRes를 LeaderboardPlayer로 변환한다", () => {
      const rank = {
        playerId: 1,
        rank: 2,
        nickname: "testuser",
        totalPoints: 100,
      };

      const result = toLeaderboardPlayerFromTotal(rank);

      expect(result).toEqual({
        playerId: 1,
        rank: 2,
        username: "testuser",
        profileImage: expect.stringContaining("testuser"),
        points: 100,
      });
    });
  });

  describe("toLeaderboardPlayerFromActivity", () => {
    it("ActivityRankRes를 LeaderboardPlayer로 변환한다", () => {
      const rank = {
        playerId: 1,
        rank: 3,
        nickname: "devuser",
        count: 42,
      };

      const result = toLeaderboardPlayerFromActivity(rank);

      expect(result).toEqual({
        playerId: 1,
        rank: 3,
        username: "devuser",
        profileImage: expect.stringContaining("devuser"),
        points: 42,
      });
    });
  });

  describe("toMyRankPlayerFromTotal", () => {
    const ranks = [
      { playerId: 1, rank: 1, nickname: "user1", totalPoints: 200 },
      { playerId: 2, rank: 2, nickname: "user2", totalPoints: 100 },
    ];

    it("내 playerId가 랭킹에 있으면 해당 데이터를 반환한다", () => {
      const result = toMyRankPlayerFromTotal(ranks, 2, "user2");
      expect(result.rank).toBe(2);
      expect(result.points).toBe(100);
    });

    it("내 playerId가 랭킹에 없으면 마지막 순위+1을 반환한다", () => {
      const result = toMyRankPlayerFromTotal(ranks, 99, "newuser");
      expect(result.rank).toBe(3);
      expect(result.points).toBe(0);
    });

    it("playerId가 undefined이면 0을 사용한다", () => {
      const result = toMyRankPlayerFromTotal(ranks, undefined, undefined);
      expect(result.playerId).toBe(0);
      expect(result.username).toBe("Unknown");
    });
  });

  describe("toMyRankPlayerFromActivity", () => {
    const ranks = [
      { playerId: 1, rank: 1, nickname: "user1", count: 50 },
      { playerId: 2, rank: 2, nickname: "user2", count: 30 },
    ];

    it("내 playerId가 랭킹에 있으면 해당 데이터를 반환한다", () => {
      const result = toMyRankPlayerFromActivity(ranks, 1, "user1");
      expect(result.rank).toBe(1);
      expect(result.points).toBe(50);
    });

    it("내 playerId가 랭킹에 없으면 마지막 순위+1을 반환한다", () => {
      const result = toMyRankPlayerFromActivity(ranks, 99, "newuser");
      expect(result.rank).toBe(3);
      expect(result.points).toBe(0);
    });
  });
});
