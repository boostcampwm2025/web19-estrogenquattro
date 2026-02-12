"use client";

import { Trophy } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useTranslation } from "react-i18next";

const PIXEL_BORDER = "border-3 border-amber-900";

export default function LeaderboardButton() {
  const { t } = useTranslation("ui");
  const { toggleModal } = useModalStore(
    useShallow((state) => ({ toggleModal: state.toggleModal })),
  );

  return (
    <button
      id="leaderboard-button"
      onClick={() => toggleModal(MODAL_TYPES.LEADERBOARD)}
      className={`flex h-12 w-12 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-[#ffecb3] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all hover:bg-amber-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
      aria-label={t(($) => $.leaderboard.openButton)}
    >
      <Trophy className="h-6 w-6 text-amber-900" />
    </button>
  );
}
