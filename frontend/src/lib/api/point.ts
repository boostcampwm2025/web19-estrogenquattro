import { fetchApi } from "./client";

export interface DailyPointRes {
  id: number;
  amount: number;
  createdAt: string; // ISO8601 UTC 문자열
}

export interface PlayerRankRes {
  playerId: number;
  nickname: string;
  totalPoints: number;
  rank: number;
}

export const pointApi = {
  /** 1년치 포인트 조회 (히트맵용) */
  getPoints: (targetPlayerId: number, currentTime: string) =>
    fetchApi<DailyPointRes[]>(
      `/api/points?targetPlayerId=${targetPlayerId}&currentTime=${encodeURIComponent(currentTime)}`,
    ),

  /** 주간 리더보드 조회 */
  getRanks: (weekendStartAt: string) =>
    fetchApi<PlayerRankRes[]>(
      `/api/points/ranks?weekendStartAt=${encodeURIComponent(weekendStartAt)}`,
    ),

  /** 테스트용 포인트 10P 적립 */
  /*   addDebugPoint: () =>
    fetchApi<{ success: boolean; addedPoint: number }>(
      "/api/points/debug/add",
      {
        method: "POST",
      },
    ), */
};
