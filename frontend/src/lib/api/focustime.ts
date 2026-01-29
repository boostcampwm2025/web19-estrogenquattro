import { fetchApi } from "./client";
import { FocusStatus } from "@/stores/useFocusTimeStore";

export interface DailyFocusTimeRes {
  id: number | null;
  totalFocusSeconds: number;
  status: FocusStatus;
  createdAt: string;
  lastFocusStartTime: string | null;
}

export const focustimeApi = {
  /** 일별 집중 시간 조회 */
  getFocusTime: (playerId: number, startAt: string, endAt: string) =>
    fetchApi<DailyFocusTimeRes>(
      `/api/focustime/${playerId}?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`,
    ),
};
