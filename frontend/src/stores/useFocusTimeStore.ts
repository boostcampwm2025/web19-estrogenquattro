import { create } from "zustand";
import { getSocket } from "@/lib/socket";

export const FOCUS_STATUS = {
  FOCUSING: "FOCUSING",
  RESTING: "RESTING",
} as const;

export type FocusStatus = (typeof FOCUS_STATUS)[keyof typeof FOCUS_STATUS];

export interface FocusTimeData {
  status: FocusStatus;
  totalFocusSeconds: number;
  currentSessionSeconds: number;
}

interface FocusTimeStore {
  // 내 상태
  focusTime: number;
  baseFocusSeconds: number; // 집중 시작 시점의 누적 시간 (경과 시간 계산용)
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
  startFocusing: (taskName?: string, taskId?: number) => void;
  stopFocusing: () => void;

  // 서버 동기화 액션
  syncFromServer: (data: FocusTimeData) => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,
  baseFocusSeconds: 0,
  isFocusTimerRunning: false,
  status: FOCUS_STATUS.RESTING,
  error: null,
  focusStartTimestamp: null,

  setFocusTime: (time) => set({ focusTime: time }),
  incrementFocusTime: () =>
    set((state) => ({ focusTime: state.focusTime + 1 })),
  resetFocusTime: () => set({ focusTime: 0 }),
  setFocusTimerRunning: (isRunning) => set({ isFocusTimerRunning: isRunning }),
  clearError: () => set({ error: null }),

  startFocusing: (taskName?: string, taskId?: number) => {
    const socket = getSocket();
    if (!socket?.connected) {
      set({
        error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }
    socket.emit("focusing", { taskName, taskId });
    set((state) => ({
      status: FOCUS_STATUS.FOCUSING,
      isFocusTimerRunning: true,
      focusStartTimestamp: Date.now(),
      baseFocusSeconds: state.focusTime, // 집중 시작 시점의 누적 시간 저장
      error: null,
    }));
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
      status: FOCUS_STATUS.RESTING,
      isFocusTimerRunning: false,
      focusStartTimestamp: null,
      error: null,
    });
  },

  syncFromServer: (data: FocusTimeData) => {
    const isFocusing = data.status === "FOCUSING";
    const baseSeconds = data.totalFocusSeconds;
    const totalSeconds =
      baseSeconds + (isFocusing ? data.currentSessionSeconds : 0);

    // 시작 타임스탬프 역산 (클라이언트 단일 시계 내에서 계산)
    const focusStartTimestamp = isFocusing
      ? Date.now() - data.currentSessionSeconds * 1000
      : null;

    set({
      status: data.status,
      isFocusTimerRunning: isFocusing,
      focusTime: totalSeconds,
      baseFocusSeconds: baseSeconds, // 경과 시간 계산용 기준값
      focusStartTimestamp,
      error: null,
    });
  },
}));
