"use client";

import { useRef, useState } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useInView } from "react-intersection-observer";
import { ArrowUp } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useGuestbookEntries,
  useCreateGuestbook,
  useDeleteGuestbook,
} from "@/lib/api/hooks/useGuestbook";
import GuestbookEntryCard from "./GuestbookEntryCard";
import GuestbookInputForm from "./GuestbookInputForm";
import Toast from "@/app/_components/Toast";
import { ApiError } from "@/lib/api/client";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";
const MAX_MESSAGE_LENGTH = 200;

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
  const currentPlayerId = user?.playerId;

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGuestbookEntries(isOpen);
  const createMutation = useCreateGuestbook();
  const deleteMutation = useDeleteGuestbook();

  const entries = data?.pages.flatMap((page) => page.items) ?? [];

  const { ref: bottomRef } = useInView({
    threshold: 0,
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.message.includes("하루에 한 번")) {
        return t(($) => $.guestbook.dailyLimitError);
      }
      if (error.message.includes("1~200자")) {
        return t(($) => $.guestbook.lengthError);
      }
    }
    return t(($) => $.guestbook.submitError);
  };

  const handleSubmit = () => {
    const trimmed = newMessage.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate(trimmed, {
      onSuccess: () => {
        setNewMessage("");
        setToast({
          message: t(($) => $.guestbook.submitSuccess),
          variant: "success",
        });
      },
      onError: (error) => {
        setToast({ message: getErrorMessage(error), variant: "error" });
      },
    });
  };

  const handleDelete = (entryId: number) => {
    if (deleteMutation.isPending) return;
    deleteMutation.mutate(entryId, {
      onError: () => {
        setToast({
          message: t(($) => $.guestbook.deleteError),
          variant: "error",
        });
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
      {!isOpen ? null : (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
          onClick={handleBackdropClick}
        >
          <div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guestbook-title"
            onKeyDown={stopPropagation}
            onKeyUp={stopPropagation}
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
                className="retro-scrollbar max-h-80 min-h-16 space-y-1 overflow-y-auto pr-2"
              >
                {entries.length === 0 ? (
                  <div className="flex min-h-16 items-center justify-center text-sm text-amber-700">
                    {t(($) => $.guestbook.empty)}
                  </div>
                ) : (
                  entries.map((entry) => (
                    <GuestbookEntryCard
                      key={entry.id}
                      entry={entry}
                      isMine={entry.player.id === currentPlayerId}
                      onDelete={handleDelete}
                    />
                  ))
                )}
                {hasNextPage && (
                  <div ref={bottomRef} className="py-2 text-center">
                    <span className="text-xs text-amber-500">...</span>
                  </div>
                )}
              </div>
              {showScrollTop && (
                <button
                  type="button"
                  onClick={scrollToTop}
                  aria-label={t(($) => $.guestbook.scrollToTop)}
                  className={`absolute top-5 right-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-amber-900 bg-amber-200 text-amber-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)] transition-all hover:bg-amber-300 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.35)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
                >
                  <ArrowUp className="h-[18px] w-[18px]" />
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
      )}
    </>
  );
}
