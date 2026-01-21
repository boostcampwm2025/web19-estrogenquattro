import { create } from "zustand";

interface UserInfoState {
  isOpen: boolean;
  targetPlayerId: number | null;
  targetUsername: string | null;
  openModal: (playerId: number, username: string) => void;
  closeModal: () => void;
}

export const useUserInfoStore = create<UserInfoState>((set) => ({
  isOpen: false,
  targetPlayerId: null,
  targetUsername: null,
  openModal: (playerId, username) =>
    set({ isOpen: true, targetPlayerId: playerId, targetUsername: username }),
  closeModal: () =>
    set({ isOpen: false, targetPlayerId: null, targetUsername: null }),
}));
