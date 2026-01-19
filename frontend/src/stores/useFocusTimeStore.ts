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
    console.log("[DEBUG useFocusTimeStore] startFocusing called with:", taskName);
    if (!socket?.connected) {
      console.log("[DEBUG useFocusTimeStore] socket not connected");
      set({
        error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }
    console.log("[DEBUG useFocusTimeStore] emitting 'focusing' with:", { taskName });
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
}));
