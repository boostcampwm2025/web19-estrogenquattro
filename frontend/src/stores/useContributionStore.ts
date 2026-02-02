"use client";

import { create } from "zustand";

interface ContributionStore {
  contributions: Record<string, number>; // { username: points }
  setContributions: (data: Record<string, number>) => void;
  reset: () => void;
}

export const useContributionStore = create<ContributionStore>((set) => ({
  contributions: {},

  setContributions: (data) => set({ contributions: data }),

  reset: () => set({ contributions: {} }),
}));
