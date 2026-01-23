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
  status: FocusStatus;
  isFocusTimerRunning: boolean;
  error: string | null;

  // 서버 기준 타임스탬프 (브라우저 쓰로틀링 무관 시간 계산용)
  baseFocusSeconds: number; // 이전 세션까지의 누적 시간
  serverCurrentSessionSeconds: number; // 서버가 계산한 현재 세션 경과 시간
  serverReceivedAt: number; // 서버 응답 수신 시점 (클라이언트 시간)

  // 계산된 표시값 getter (타임스탬프 기반 계산)
  getFocusTime: () => number;

  // 기존 액션 (하위 호환성)
  setFocusTime: (time: number) => void;
  resetFocusTime: () => void;
  setFocusTimerRunning: (isRunning: boolean) => void;
  clearError: () => void;

  // 소켓 연동 액션
  startFocusing: (taskName?: string, taskId?: number) => void;
  stopFocusing: () => void;

  // 서버 동기화 액션
  syncFromServer: (data: FocusTimeData) => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set, get) => ({
  status: FOCUS_STATUS.RESTING,
  isFocusTimerRunning: false,
  error: null,

  // 서버 기준 타임스탬프
  baseFocusSeconds: 0,
  serverCurrentSessionSeconds: 0,
  serverReceivedAt: 0,

  // 타임스탬프 기반 시간 계산 (쓰로틀링 무관)
  getFocusTime: () => {
    const {
      status,
      baseFocusSeconds,
      serverCurrentSessionSeconds,
      serverReceivedAt,
    } = get();

    if (status === FOCUS_STATUS.FOCUSING && serverReceivedAt > 0) {
      const rawElapsed = Math.floor((Date.now() - serverReceivedAt) / 1000);
      const clientElapsed = Math.max(0, rawElapsed);
      return baseFocusSeconds + serverCurrentSessionSeconds + clientElapsed;
    }

    return baseFocusSeconds;
  },

  // 하위 호환성 (baseFocusSeconds 직접 설정)
  setFocusTime: (time) => set({ baseFocusSeconds: time }),
  resetFocusTime: () =>
    set({
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
    }),
  setFocusTimerRunning: (isRunning) => set({ isFocusTimerRunning: isRunning }),
  clearError: () => set({ error: null }),

  startFocusing: (taskName?: string, taskId?: number) => {
    const prev = get();

    // Guard: taskId가 없고 이미 FOCUSING이면 무시 (no-op)
    // taskId가 있으면 Task 전환이므로 서버에 알려야 함
    const isTaskSwitch = taskId !== undefined;
    if (prev.status === "FOCUSING" && !isTaskSwitch) {
      return;
    }

    const socket = getSocket();
    if (!socket?.connected) {
      set({
        error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }

    // 낙관적 업데이트 (타임스탬프 기반)
    // 이미 FOCUSING이어도 태스크 전환을 위해 서버에 전송
    const currentFocusTime = prev.getFocusTime();
    set({
      status: FOCUS_STATUS.FOCUSING,
      isFocusTimerRunning: true,
      baseFocusSeconds: currentFocusTime, // 현재까지 누적된 시간 보존
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: Date.now(),
      error: null,
    });

    // 소켓 이벤트 전송 (응답 callback 포함)
    socket.emit(
      "focusing",
      { taskName, taskId },
      (response: { success: boolean; error?: string }) => {
        if (!response?.success) {
          // 에러 시 이전 상태로 완전 롤백 (집중 세션 유지)
          set({
            status: prev.status,
            isFocusTimerRunning: prev.isFocusTimerRunning,
            baseFocusSeconds: prev.baseFocusSeconds,
            serverCurrentSessionSeconds: prev.serverCurrentSessionSeconds,
            serverReceivedAt: prev.serverReceivedAt,
            error: response?.error || "집중 시작에 실패했습니다.",
          });
        }
      },
    );
  },

  stopFocusing: () => {
    const prev = get();

    // 이미 RESTING이면 무시
    if (prev.status === FOCUS_STATUS.RESTING) return;

    const socket = getSocket();
    if (!socket?.connected) {
      set({
        error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }

    // 낙관적 업데이트 (현재 시간을 baseFocusSeconds에 반영)
    const currentFocusTime = prev.getFocusTime();
    set({
      status: FOCUS_STATUS.RESTING,
      isFocusTimerRunning: false,
      baseFocusSeconds: currentFocusTime,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
      error: null,
    });

    // 소켓 이벤트 전송 (응답 callback 포함)
    socket.emit(
      "resting",
      {},
      (response: { success: boolean; error?: string }) => {
        if (!response?.success) {
          // 에러 시 이전 상태로 롤백 (시간 연속성 유지)
          set({
            status: prev.status,
            isFocusTimerRunning: prev.isFocusTimerRunning,
            baseFocusSeconds: prev.baseFocusSeconds,
            serverCurrentSessionSeconds: prev.serverCurrentSessionSeconds,
            serverReceivedAt: prev.serverReceivedAt,
            error: response?.error || "휴식 전환에 실패했습니다.",
          });
        }
      },
    );
  },

  syncFromServer: (data: FocusTimeData) => {
    const isFocusing = data.status === FOCUS_STATUS.FOCUSING;

    set({
      status: data.status,
      isFocusTimerRunning: isFocusing,
      baseFocusSeconds: data.totalFocusSeconds,
      serverCurrentSessionSeconds: isFocusing ? data.currentSessionSeconds : 0,
      serverReceivedAt: isFocusing ? Date.now() : 0,
      error: null,
    });
  },
}));
