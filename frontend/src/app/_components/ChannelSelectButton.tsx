"use client";

import { useShallow } from "zustand/react/shallow";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useRoomStore } from "@/stores/useRoomStore";

const PIXEL_BORDER = "border-3 border-amber-900";

export default function ChannelSelectButton() {
  const { toggleModal } = useModalStore(
    useShallow((state) => ({ toggleModal: state.toggleModal })),
  );
  const roomNumber = useRoomStore((state) => state.roomId).split("-")[1];

  return (
    <button
      id="channel-select-button"
      onClick={() => toggleModal(MODAL_TYPES.CHANNEL_SELECT)}
      className={`flex h-12 w-12 cursor-pointer items-center justify-center font-bold ${PIXEL_BORDER} bg-[#ffecb3] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all hover:bg-amber-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
      aria-label="채널 선택"
    >
      <span className="tracking-wider text-amber-900">
        {roomNumber ? `CH.${roomNumber}` : "CH"}
      </span>
    </button>
  );
}
