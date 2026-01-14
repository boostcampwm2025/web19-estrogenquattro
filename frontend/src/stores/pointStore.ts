import { create } from "zustand";

interface PointState {
  points: number;
  addPoints: (amount: number) => void;
  subtractPoints: (amount: number) => boolean;
  setPoints: (amount: number) => void;
}

export const usePointStore = create<PointState>((set, get) => ({
  points: 3000, // 임시 Mock Points

  addPoints: (amount) => set((state) => ({ points: state.points + amount })),

  subtractPoints: (amount) => {
    const currentPoints = get().points;
    if (currentPoints < amount) return false;
    set({ points: currentPoints - amount });
    return true;
  },

  setPoints: (amount) => set({ points: amount }),
}));
