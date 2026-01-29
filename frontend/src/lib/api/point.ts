import { fetchApi } from "./client";
import { GitEventHistoryRes } from "./types/types";

export interface DailyPointRes {
  id: number;
  amount: number;
  createdAt: string; // ISO8601 UTC 문자열
  activityAt: string | null; // ISO8601 UTC 문자열 (실제 GitHub 활동 시간)
}

export interface TotalRankRes {
  playerId: number;
  nickname: string;
  totalPoints: number;
  rank: number;
}

export interface ActivityRankRes {
  playerId: number;
  nickname: string;
  count: number;
  rank: number;
}

export const pointApi = {
  /** 1년치 포인트 조회 (히트맵용) */
  getPoints: (targetPlayerId: number, currentTime: string) =>
    fetchApi<DailyPointRes[]>(
      `/api/points?targetPlayerId=${targetPlayerId}&currentTime=${encodeURIComponent(currentTime)}`,
    ),

  /** Git 이벤트 히스토리 조회 */
  getGitEventHistories: (
    targetPlayerId: number,
    startAt: string,
    endAt: string,
  ) =>
    fetchApi<GitEventHistoryRes[]>(
      `/api/git-histories?targetPlayerId=${targetPlayerId}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`,
    ),

  /** 주간 리더보드 조회 (전체 포인트) */
  getRanks: (weekendStartAt: string) =>
    fetchApi<TotalRankRes[]>(
      `/api/points/ranks?weekendStartAt=${encodeURIComponent(weekendStartAt)}`,
    ),

  /** 주간 히스토리 랭킹 조회 (포인트 타입별) */
  getHistoryRanks: (weekendStartAt: string, type: string) =>
    fetchApi<ActivityRankRes[]>(
      `/api/history-ranks?weekendStartAt=${encodeURIComponent(weekendStartAt)}&type=${type}`,
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
