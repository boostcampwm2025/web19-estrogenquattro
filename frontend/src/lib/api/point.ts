import { fetchApi } from "./client";

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
};
