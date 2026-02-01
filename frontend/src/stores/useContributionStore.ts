"use client";

import { create } from "zustand";

interface ContributionStore {
  contributions: Record<string, number>; // { username: count }
  setContributions: (data: Record<string, number>) => void;
  reset: () => void;
}

// TODO: 테스트 완료 후 빈 객체로 변경
const MOCK_DATA: Record<string, number> = {
  testuser1: 15,
  testuser2: 12,
  testuser3: 8,
  testuser4: 5,
  testuser5: 3,
};

export const useContributionStore = create<ContributionStore>((set) => ({
  contributions: MOCK_DATA, // 테스트용 mock 데이터

  setContributions: (data) => set({ contributions: data }),

  reset: () => set({ contributions: {} }),
}));
