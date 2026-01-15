import { create } from "zustand";

interface FocusTimeStore {
  focusTime: number;
  isFocusTimerRunning: boolean;
  setFocusTime: (time: number) => void;
  incrementFocusTime: () => void;
  resetFocusTime: () => void;
  setFocusTimerRunning: (isRunning: boolean) => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,
  isFocusTimerRunning: false,
  setFocusTime: (time) => set({ focusTime: time }),
  incrementFocusTime: () =>
    set((state) => ({ focusTime: state.focusTime + 1 })),
  resetFocusTime: () => set({ focusTime: 0 }),
  setFocusTimerRunning: (isRunning) => set({ isFocusTimerRunning: isRunning }),
}));
