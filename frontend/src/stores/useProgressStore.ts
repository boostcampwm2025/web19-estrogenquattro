import { create } from "zustand";

interface ProgressStore {
  progress: number;
  onProgressComplete?: () => void;

  addProgress: (amount: number) => void;
  setProgress: (value: number) => void;
  reset: () => void;
  getProgress: () => number;
  setOnProgressComplete: (callback: () => void) => void;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  progress: 0,
  onProgressComplete: undefined,

  addProgress: (amount: number) => {
    const currentProgress = get().progress;
    const newProgress = Math.min(currentProgress + amount, 100);

    set({ progress: newProgress });

    // 100% 도달 시 콜백 호출 후 1초 뒤 리셋
    if (newProgress >= 100 && get().onProgressComplete) {
      get().onProgressComplete?.();

      setTimeout(() => {
        set({ progress: 0 });
      }, 1000);
    }
  },

  setProgress: (value: number) => {
    set({ progress: Math.max(0, Math.min(100, value)) });
  },

  reset: () => {
    set({ progress: 0 });
  },

  getProgress: () => {
    return get().progress;
  },

  setOnProgressComplete: (callback: () => void) => {
    set({ onProgressComplete: callback });
  },
}));
