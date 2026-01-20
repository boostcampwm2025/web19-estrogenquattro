import { fetchApi } from "./client";

export interface DailyPointRes {
  id: number;
  playerId: number;
  amount: number;
  createdDate: string;
}

export const pointApi = {
  /** 1년치 포인트 조회 (히트맵용) */
  getPoints: () => fetchApi<DailyPointRes[]>("/api/points"),
};
