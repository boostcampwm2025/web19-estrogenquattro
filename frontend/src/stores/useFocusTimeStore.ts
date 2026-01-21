import { create } from "zustand";
import { getSocket } from "@/lib/socket";

export type FocusStatus = "FOCUSING" | "RESTING";

export interface FocusTimeData {
  status: FocusStatus;
  totalFocusMinutes: number;
  currentSessionSeconds: number;
}

interface FocusTimeStore {
  // 내 상태
  focusTime: number;
  isFocusTimerRunning: boolean;
  status: FocusStatus;
  error: string | null;
  focusStartTimestamp: number | null;

  // 기존 액션
  setFocusTime: (time: number) => void;
  incrementFocusTime: () => void;
  resetFocusTime: () => void;
  setFocusTimerRunning: (isRunning: boolean) => void;
  clearError: () => void;

  // 소켓 연동 액션
  startFocusing: (taskName?: string) => void;
  stopFocusing: () => void;

  // 서버 동기화 액션
  syncFromServer: (data: FocusTimeData) => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,
  isFocusTimerRunning: false,
  status: "RESTING",
  error: null,
  focusStartTimestamp: null,

  setFocusTime: (time) => set({ focusTime: time }),
  incrementFocusTime: () =>
    set((state) => ({ focusTime: state.focusTime + 1 })),
  resetFocusTime: () => set({ focusTime: 0 }),
  setFocusTimerRunning: (isRunning) => set({ isFocusTimerRunning: isRunning }),
  clearError: () => set({ error: null }),

  startFocusing: (taskName?: string) => {
    const socket = getSocket();
    if (!socket?.connected) {
      set({
        error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }
    socket.emit("focusing", { taskName });
    set({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      focusStartTimestamp: Date.now(),
      error: null,
    });
  },

  stopFocusing: () => {
    const socket = getSocket();
    if (!socket?.connected) {
      set({
        error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }
    socket.emit("resting");
    set({
      status: "RESTING",
      isFocusTimerRunning: false,
      focusStartTimestamp: null,
      error: null,
    });
  },

  syncFromServer: (data: FocusTimeData) => {
    const isFocusing = data.status === "FOCUSING";
    const totalSeconds =
      data.totalFocusMinutes * 60 +
      (isFocusing ? data.currentSessionSeconds : 0);

    // 시작 타임스탬프 역산 (클라이언트 단일 시계 내에서 계산)
    const focusStartTimestamp = isFocusing
      ? Date.now() - data.currentSessionSeconds * 1000
      : null;

    set({
      status: data.status,
      isFocusTimerRunning: isFocusing,
      focusTime: totalSeconds,
      focusStartTimestamp,
      error: null,
    });
  },
}));
