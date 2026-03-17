"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { Megaphone, Loader2, ArrowUp } from "lucide-react";
import {
  getPublicNotifications,
  type NoticeItem,
} from "@/lib/api/notification";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";

export default function NoticeModal() {
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );

  const isOpen = activeModal === MODAL_TYPES.NOTICE;

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPublicNotifications();
      setNotices(data);
    } catch (error) {
      console.error("Failed to fetch notices:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotices();
      setExpandedId(null);
      setShowScrollTop(false);
    }
  }, [isOpen, fetchNotices]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) setShowScrollTop(el.scrollTop > 200);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {!isOpen ? null : (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
          onClick={handleBackdropClick}
        >
          <div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
            onKeyDown={stopPropagation}
            onKeyUp={stopPropagation}
            className={`relative flex w-full max-w-[768px] flex-col ${PIXEL_BG} ${PIXEL_BORDER} p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
          >
            {/* 헤더 */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-amber-900" />
                <h2
                  id="notice-modal-title"
                  className="text-xl font-extrabold tracking-wider text-amber-900"
                >
                  공지사항
                </h2>
              </div>
              <button
                onClick={handleClose}
                aria-label="닫기"
                className={`flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-red-400 leading-none font-bold text-white shadow-[2px_2px_0px_0px_rgba(30,30,30,0.3)] hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
              >
                X
              </button>
            </div>

            {/* 공지 목록 (스크롤 영역) */}
            <div className={`relative ${PIXEL_BORDER} bg-white/50 p-3`}>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="retro-scrollbar max-h-80 min-h-16 space-y-1 overflow-y-auto pr-2"
              >
                {isLoading ? (
                  <div className="flex min-h-16 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
                  </div>
                ) : notices.length === 0 ? (
                  <div className="flex min-h-16 items-center justify-center text-sm text-amber-700">
                    등록된 공지사항이 없습니다.
                  </div>
                ) : (
                  notices.map((notice) => (
                    <div
                      key={notice.id}
                      className="border-b border-[#f5deb3]/50 py-1 last:border-b-0"
                    >
                      {/* 공지 헤더 */}
                      <button
                        onClick={() => toggleExpand(notice.id)}
                        className="flex w-full cursor-pointer items-center gap-3 py-1 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-amber-900">
                              {notice.title}
                            </span>
                            <span className="shrink-0 text-xs text-amber-500">
                              {formatDate(notice.createdAt)}
                            </span>
                          </div>
                          {notice.author?.nickname && (
                            <p className="mt-0.5 text-xs text-amber-600">
                              by {notice.author.nickname}
                            </p>
                          )}
                        </div>
                      </button>

                      {/* 공지 내용 (펼침) */}
                      {expandedId === notice.id && (
                        <div className="mt-1 mb-1 rounded bg-amber-50/80 px-3 py-2">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-800">
                            {notice.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {showScrollTop && (
                <button
                  type="button"
                  onClick={scrollToTop}
                  aria-label="맨 위로 스크롤"
                  className="absolute top-5 right-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-amber-900 bg-amber-200 text-amber-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)] transition-all hover:bg-amber-300 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.35)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <ArrowUp className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
