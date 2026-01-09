import { create } from "zustand";

interface FocusTimeStore {
  focusTime: number;
  setFocusTime: (time: number) => void;
  incrementFocusTime: () => void;
  resetFocusTime: () => void;
}

export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,
  setFocusTime: (time) => set({ focusTime: time }),
  incrementFocusTime: () =>
    set((state) => ({ focusTime: state.focusTime + 1 })),
  resetFocusTime: () => set({ focusTime: 0 }),
}));
