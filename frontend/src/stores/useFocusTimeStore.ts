import { create } from "zustand";
import { getSocket } from "@/lib/socket";

export type FocusStatus = "FOCUSING" | "RESTING";

interface FocusTimeStore {
  // 내 상태
  focusTime: number;
  isFocusTimerRunning: boolean;
  status: FocusStatus;
  error: string | null;

  // 기존 액션
  setFocusTime: (time: number) => void;
  incrementFocusTime: () => void;
  resetFocusTime: () => void;
  setFocusTimerRunning: (isRunning: boolean) => void;
  clearError: () => void;

  // 소켓 연동 액션
  startFocusing: (taskName?: string) => void;
  stopFocusing: () => void;

  // 서버 동기화 액션 (새로고침 시 복원용)
  syncFromServer: (data: {
    status: FocusStatus;
    totalFocusMinutes: number;
    currentSessionSeconds: number;
  }) => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,
  isFocusTimerRunning: false,
  status: "RESTING",
  error: null,

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
      error: null,
    });
  },

  syncFromServer: (data) => {
    const isFocusing = data.status === "FOCUSING";
    // 총 집중 시간 = 누적 분 * 60 + 현재 세션 초
    const totalSeconds =
      data.totalFocusMinutes * 60 +
      (isFocusing ? data.currentSessionSeconds : 0);

    set({
      status: data.status,
      isFocusTimerRunning: isFocusing,
      focusTime: totalSeconds,
      error: null,
    });
  },
}));
