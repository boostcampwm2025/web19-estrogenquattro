"use client";

import { useEffect } from "react";
import { Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  useNoticePopupStore,
  type NoticePopupData,
} from "@/stores/useNoticePopupStore";
import { getNewNotice, type NoticeItem } from "@/lib/api/notice";
import { getSocket } from "@/lib/socket";
import MarkdownRenderer from "./MarkdownRenderer";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";

function normalizeNoticeItem(item: NoticeItem): NoticePopupData {
  return {
    id: item.id,
    ko: { title: item.titleKo, content: item.contentKo },
    en: { title: item.titleEn, content: item.contentEn },
    createdAt: item.createdAt,
  };
}

export default function NoticePopup() {
  const { notice, isOpen, showNotice, dismiss } = useNoticePopupStore(
    useShallow((state) => ({
      notice: state.notice,
      isOpen: state.isOpen,
      showNotice: state.showNotice,
      dismiss: state.dismiss,
    })),
  );

  const { t, i18n } = useTranslation("ui");
  const isEnglish = i18n.language?.startsWith("en");

  // 초기 접속 시 미읽은 공지 확인
  useEffect(() => {
    getNewNotice()
      .then((item) => {
        if (item) showNotice(normalizeNoticeItem(item));
      })
      .catch(() => {});
  }, [showNotice]);

  // 실시간 소켓 이벤트 수신
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: {
      noticeId: number;
      ko: { title: string; content: string };
      en: { title: string; content: string };
      createdAt: string;
    }) => {
      showNotice({
        id: data.noticeId,
        ko: data.ko,
        en: data.en,
        createdAt: data.createdAt,
      });
    };
    socket.on("noticed", handler);
    return () => {
      socket.off("noticed", handler);
    };
  }, [showNotice]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dismiss]);

  if (!isOpen || !notice) return null;

  const title = isEnglish ? notice.en.title : notice.ko.title;
  const content = isEnglish ? notice.en.content : notice.ko.content;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={dismiss}
    >
      <div
        className={`relative w-full max-w-lg ${PIXEL_BG} ${PIXEL_BORDER} p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-popup-title"
      >
        {/* 헤더 */}
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-amber-900" />
          <h2
            id="notice-popup-title"
            className="text-lg font-extrabold tracking-wider text-amber-900"
          >
            {title}
          </h2>
        </div>

        {/* 내용 */}
        <div
          className={`${PIXEL_BORDER} retro-scrollbar max-h-60 overflow-y-auto bg-white/50 p-3`}
        >
          <MarkdownRenderer content={content} />
        </div>

        {/* 닫기 버튼 */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={dismiss}
            autoFocus
            className={`cursor-pointer ${PIXEL_BORDER} bg-amber-200 px-5 py-1.5 text-sm font-bold tracking-wide text-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all hover:brightness-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
          >
            {t(($) => $.noticePopup.dismiss)}
          </button>
        </div>
      </div>
    </div>
  );
}
