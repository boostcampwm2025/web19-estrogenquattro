import { fetchApi } from "./client";
import { GitEventHistoryRes } from "./types/types";

export interface DailyPointRes {
  id: number;
  amount: number;
  createdAt: string; // ISO8601 UTC 문자열
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

  /** 테스트용 포인트 10P 적립 */
  /*   addDebugPoint: () =>
    fetchApi<{ success: boolean; addedPoint: number }>(
      "/api/points/debug/add",
      {
        method: "POST",
      },
    ), */
};
