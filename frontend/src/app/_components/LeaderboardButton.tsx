"use client";

import { Trophy } from "lucide-react";
import { useLeaderboardStore } from "@/stores/useLeaderboardStore";

const PIXEL_BORDER = "border-3 border-amber-900";

export default function LeaderboardButton() {
  const toggleModal = useLeaderboardStore((state) => state.toggleModal);

  return (
    <button
      onClick={toggleModal}
      className={`flex h-12 w-12 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-[#ffecb3] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all hover:bg-amber-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
      aria-label="순위표 열기"
    >
      <Trophy className="h-6 w-6 text-amber-900" />
    </button>
  );
}
