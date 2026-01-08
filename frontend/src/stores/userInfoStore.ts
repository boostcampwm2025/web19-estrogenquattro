import { create } from "zustand";

interface UserInfoState {
  isOpen: boolean;
  targetUserId: string | null;
  targetUsername: string | null;
  openModal: (userId: string, username: string) => void;
  closeModal: () => void;
}

export const useUserInfoStore = create<UserInfoState>((set) => ({
  isOpen: false,
  targetUserId: null,
  targetUsername: null,
  openModal: (userId, username) =>
    set({ isOpen: true, targetUserId: userId, targetUsername: username }),
  closeModal: () =>
    set({ isOpen: false, targetUserId: null, targetUsername: null }),
}));
