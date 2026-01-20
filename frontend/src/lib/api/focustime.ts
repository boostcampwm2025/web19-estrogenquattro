import { fetchApi } from "./client";
import { FocusStatus } from "@/stores/useFocusTimeStore";

export interface DailyFocusTimeRes {
  id: number;
  totalFocusMinutes: number;
  status: FocusStatus;
  createdDate: string;
  lastFocusStartTime: string | null;
}

export const focustimeApi = {
  /** 일별 집중 시간 조회 */
  getFocusTime: (date: string) =>
    fetchApi<DailyFocusTimeRes>(`/api/focustime?date=${date}`),
};
