import { create } from "zustand";

const TOTAL_STAGES = 5;

interface ProgressStore {
  progress: number;
  mapIndex: number; // 현재 맵 인덱스 (0-4)
  progressThreshold: number; // 현재 맵의 기준값
  onProgressComplete?: () => void;

  addProgress: (amount: number) => void;
  setProgress: (value: number) => void;
  setMapIndex: (index: number) => void;
  setProgressThreshold: (threshold: number) => void;
  reset: () => void;
  getProgress: () => number;
  setOnProgressComplete: (callback: () => void) => void;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  progress: 0,
  mapIndex: 0,
  progressThreshold: 200, // 맵 0 기본값

  addProgress: (amount: number) => {
    const currentProgress = get().progress;
    const threshold = get().progressThreshold;
    const newProgress = Math.min(currentProgress + amount, threshold);
    set({ progress: newProgress });

    // 기준값 도달 시 1초 뒤 리셋
    if (newProgress >= threshold) {
      get().onProgressComplete?.();

      setTimeout(() => {
        set({ progress: 0 });
      }, 1000);
    }
  },

  setProgress: (value: number) => {
    const threshold = get().progressThreshold;
    set({ progress: Math.max(0, Math.min(threshold, value)) });
  },

  setMapIndex: (index: number) => {
    set({ mapIndex: Math.max(0, Math.min(index, TOTAL_STAGES - 1)) });
  },

  setProgressThreshold: (threshold: number) => {
    set({ progressThreshold: threshold });
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
