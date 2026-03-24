import { create } from "zustand";
import { markNoticeAsRead } from "@/lib/api/notice";

export interface NoticePopupData {
  id: number;
  ko: { title: string; content: string };
  en: { title: string; content: string };
  createdAt: string;
}

interface NoticePopupState {
  notice: NoticePopupData | null;
  isOpen: boolean;
  showNotice: (notice: NoticePopupData) => void;
  dismiss: () => void;
}

export const useNoticePopupStore = create<NoticePopupState>((set, get) => ({
  notice: null,
  isOpen: false,

  showNotice: (notice) => set({ notice, isOpen: true }),

  dismiss: () => {
    const { notice } = get();
    set({ isOpen: false, notice: null });
    if (notice) {
      markNoticeAsRead(notice.id).catch(() => {});
    }
  },
}));
