import { create } from "zustand";

export const MODAL_TYPES = {
  USER_INFO: "userInfo",
  LEADERBOARD: "leaderboard",
} as const;

export type ModalType = (typeof MODAL_TYPES)[keyof typeof MODAL_TYPES] | null;

interface UserInfoPayload {
  playerId: number;
  username: string;
}

interface ModalState {
  activeModal: ModalType;
  userInfoPayload: UserInfoPayload | null;

  openModal: (type: ModalType, payload?: UserInfoPayload) => void;
  closeModal: () => void;
  toggleModal: (type: ModalType, payload?: UserInfoPayload) => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  activeModal: null,
  userInfoPayload: null,

  openModal: (type, payload) => {
    if (type === MODAL_TYPES.USER_INFO && !payload) {
      console.warn("UserInfo modal requires payload");
      return;
    }
    set({ activeModal: type, userInfoPayload: payload || null });
  },

  closeModal: () => set({ activeModal: null, userInfoPayload: null }),

  toggleModal: (type, payload) => {
    const { activeModal } = get();
    if (activeModal === type) {
      set({ activeModal: null, userInfoPayload: null });
    } else {
      if (type === MODAL_TYPES.USER_INFO && !payload) {
        console.warn("UserInfo modal requires payload");
        return;
      }
      set({
        activeModal: type,
        userInfoPayload: type === MODAL_TYPES.USER_INFO ? payload! : null,
      });
    }
  },
}));
