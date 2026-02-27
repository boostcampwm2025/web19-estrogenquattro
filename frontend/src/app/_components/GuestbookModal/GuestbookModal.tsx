"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useInView } from "react-intersection-observer";
import { ArrowUp } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { MOCK_GUESTBOOK_DATA } from "./mockData";
import GuestbookEntryCard from "./GuestbookEntryCard";
import GuestbookInputForm from "./GuestbookInputForm";
import type { GuestbookEntry } from "./types";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";
const PAGE_SIZE = 10;
const MAX_MESSAGE_LENGTH = 200;

// mock에서 현재 사용자 ID (실제 API 연동 시 제거)
const MOCK_CURRENT_USER_ID = 101;

export default function GuestbookModal() {
  const { t } = useTranslation("ui");
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );
  const isOpen = activeModal === MODAL_TYPES.GUESTBOOK;

  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.playerId ?? MOCK_CURRENT_USER_ID;

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // 모달 열릴 때 초기 데이터 로드
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      const initial = MOCK_GUESTBOOK_DATA.slice(0, PAGE_SIZE);
      setEntries(initial);
      setPage(1);
      setHasMore(initial.length === PAGE_SIZE);
    } else {
      setEntries([]);
      setPage(0);
      setHasMore(true);
      setNewMessage("");
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadMore = useCallback(() => {
    const start = page * PAGE_SIZE;
    const next = MOCK_GUESTBOOK_DATA.slice(start, start + PAGE_SIZE);
    if (next.length === 0) {
      setHasMore(false);
      return;
    }
    if (next.length < PAGE_SIZE) setHasMore(false);
    setEntries((prev) => [...prev, ...next]);
    setPage((p) => p + 1);
  }, [page]);

  const { ref: bottomRef } = useInView({
    threshold: 0,
    onChange: (inView) => {
      if (inView && hasMore) loadMore();
    },
  });

  const handleSubmit = () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const newEntry: GuestbookEntry = {
      id: Date.now(),
      authorId: currentUserId,
      authorName: user?.username ?? "me",
      avatarUrl: `https://avatars.githubusercontent.com/u/${currentUserId}?v=4`,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [newEntry, ...prev]);
    setNewMessage("");
  };

  const handleDelete = (entryId: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) setShowScrollTop(el.scrollTop > 200);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guestbook-title"
        className={`relative flex w-full max-w-[768px] flex-col ${PIXEL_BG} ${PIXEL_BORDER} p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="guestbook-title"
            className="text-xl font-extrabold tracking-wider text-amber-900"
          >
            {t(($) => $.guestbook.title)}
          </h2>
          <button
            onClick={handleClose}
            aria-label={t(($) => $.guestbook.closeModal)}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-red-400 leading-none font-bold text-white shadow-[2px_2px_0px_0px_rgba(30,30,30,0.3)] hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
          >
            X
          </button>
        </div>

        {/* 글 목록 (스크롤 영역) */}
        <div className={`relative mb-4 ${PIXEL_BORDER} bg-white/50 p-3`}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="retro-scrollbar max-h-80 space-y-1 overflow-y-auto pr-2"
          >
            {entries.length === 0 ? (
              <div className="py-8 text-center text-sm text-amber-700">
                {t(($) => $.guestbook.empty)}
              </div>
            ) : (
              entries.map((entry) => (
                <GuestbookEntryCard
                  key={entry.id}
                  entry={entry}
                  isMine={entry.authorId === currentUserId}
                  onDelete={handleDelete}
                />
              ))
            )}
            {hasMore && (
              <div ref={bottomRef} className="py-2 text-center">
                <span className="text-xs text-amber-500">...</span>
              </div>
            )}
          </div>
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              className={`absolute right-10 bottom-5 flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-amber-200 text-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-all hover:bg-amber-300 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 글 작성 영역 */}
        <GuestbookInputForm
          value={newMessage}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={setNewMessage}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          onKeyUp={stopPropagation}
        />
      </div>
    </div>
  );
}
