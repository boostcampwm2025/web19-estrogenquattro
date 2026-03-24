"use client";

import { BookOpen } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useTranslation } from "react-i18next";
import { useGuestbookUnreadStatus } from "@/hooks/useGuestbookUnreadStatus";

const PIXEL_BORDER = "border-3 border-amber-900";

export default function GuestbookButton() {
  const { t } = useTranslation("ui");
  const { hasUnread, markAsRead } = useGuestbookUnreadStatus();
  const { toggleModal } = useModalStore(
    useShallow((state) => ({ toggleModal: state.toggleModal })),
  );

  return (
    <button
      id="guestbook-button"
      onClick={() => {
        void markAsRead().catch(() => undefined);
        toggleModal(MODAL_TYPES.GUESTBOOK);
      }}
      className={`relative flex h-12 w-12 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-[#ffecb3] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all hover:bg-amber-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
      aria-label={t(($) => $.guestbook.openButton)}
    >
      <BookOpen className="h-6 w-6 text-amber-900" />
      {hasUnread ? (
        <span
          data-testid="guestbook-unread-badge"
          aria-hidden="true"
          className="pointer-events-none absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#ffecb3] bg-red-500 shadow-[0_0_0_2px_rgba(120,16,16,0.2)]"
        />
      ) : null}
    </button>
  );
}
