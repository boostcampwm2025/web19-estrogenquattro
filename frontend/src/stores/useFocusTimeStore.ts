import { create } from "zustand";
import { getSocket } from "@/lib/socket";

export type FocusStatus = "FOCUSING" | "RESTING";

interface FocusTimeStore {
  // 내 상태
  focusTime: number;
  isFocusTimerRunning: boolean;
  status: FocusStatus;

  // 기존 액션
  setFocusTime: (time: number) => void;
  incrementFocusTime: () => void;
  resetFocusTime: () => void;
  setFocusTimerRunning: (isRunning: boolean) => void;

  // 소켓 연동 액션
  startFocusing: () => void;
  stopFocusing: () => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,
  isFocusTimerRunning: false,
  status: "RESTING",

  setFocusTime: (time) => set({ focusTime: time }),
  incrementFocusTime: () =>
    set((state) => ({ focusTime: state.focusTime + 1 })),
  resetFocusTime: () => set({ focusTime: 0 }),
  setFocusTimerRunning: (isRunning) => set({ isFocusTimerRunning: isRunning }),

  startFocusing: () => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("focusing");
    }
    set({
      status: "FOCUSING",
      isFocusTimerRunning: true,
    });
  },

  stopFocusing: () => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("resting");
    }
    set({
      status: "RESTING",
      isFocusTimerRunning: false,
    });
  },
}));
