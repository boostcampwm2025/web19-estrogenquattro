"use client";

import { UserRound } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";

const PIXEL_BORDER = "border-3 border-amber-900";

export default function UserInfoButton() {
  const { openModal } = useModalStore(
    useShallow((state) => ({ openModal: state.openModal })),
  );
  const { user } = useAuthStore();

  const handleClick = () => {
    if (!user) return;

    openModal(MODAL_TYPES.USER_INFO, {
      playerId: user.playerId,
      username: user.username,
    });
  };

  if (!user) return null;

  return (
    <button
      onClick={handleClick}
      className={`flex h-12 w-12 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-[#ffecb3] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all hover:bg-amber-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
      aria-label="내 프로필 열기"
    >
      <UserRound className="h-6 w-6 text-amber-900" />
    </button>
  );
}
