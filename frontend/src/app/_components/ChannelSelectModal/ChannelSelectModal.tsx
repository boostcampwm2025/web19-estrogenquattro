"use client";

import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { Users, LogIn } from "lucide-react";

import { useRoomStore } from "@/stores/useRoomStore";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";

// Mock data for channels
const MOCK_CHANNELS = [
  { id: 1, name: "CH.1", count: 12, max: 12 },
  { id: 2, name: "CH.2", count: 8, max: 12 },
  { id: 3, name: "CH.3", count: 10, max: 12 },
  { id: 4, name: "CH.4", count: 5, max: 12 },
  { id: 5, name: "CH.5", count: 2, max: 12 },
];

export default function ChannelSelectModal() {
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );
  const currentRoomId = useRoomStore((state) => state.roomId).split("-")[1]; // Get current room ID
  const isOpen = activeModal === MODAL_TYPES.CHANNEL_SELECT;

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  if (!isOpen) return null;

  const handleChannelSelect = (channelId: number) => {
    // TODO: Implement channel selection logic
    console.log(`Channel ${channelId} selected`);
    // Ideally we would close the modal after selection or update UI
    // closeModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-select-title"
        className={`relative w-full max-w-lg ${PIXEL_BG} ${PIXEL_BORDER} p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="channel-select-title"
            className="text-xl font-extrabold tracking-wider text-amber-900"
          >
            채널 선택
          </h2>
          <button
            onClick={handleClose}
            aria-label="채널 선택 모달 닫기"
            className={`flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-red-400 leading-none font-bold text-white shadow-[2px_2px_0px_0px_rgba(30,30,30,0.3)] hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
          >
            X
          </button>
        </div>

        {/* Channel List */}
        <div
          className={`${PIXEL_BORDER} relative overflow-hidden bg-white/50 p-3`}
        >
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-5" />
          <div className="retro-scrollbar max-h-80 space-y-3 overflow-y-auto p-1">
            {MOCK_CHANNELS.map((channel) => {
              const isFull = channel.count >= channel.max;
              const isCurrent = currentRoomId === channel.name.split(".")[1];

              return (
                <div
                  key={channel.id}
                  className={`flex items-center justify-between ${PIXEL_BORDER} bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.01] ${
                    isCurrent
                      ? "bg-amber-50 ring-2 ring-amber-500 ring-inset"
                      : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-lg font-bold tracking-wide text-amber-900">
                      {channel.name}
                      {isCurrent && (
                        <span className="ml-2 rounded border border-green-600 px-1 text-xs text-green-600">
                          YOU
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1 text-sm text-amber-700">
                      <Users className="h-4 w-4" />
                      <span className={isFull ? "font-bold text-red-500" : ""}>
                        {channel.count} / {channel.max}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      !isFull && !isCurrent && handleChannelSelect(channel.id)
                    }
                    disabled={isFull || isCurrent}
                    className={`${PIXEL_BORDER} flex w-24 items-center justify-center gap-2 px-4 py-2 text-white transition-all ${
                      isCurrent
                        ? "cursor-default bg-green-600 shadow-none"
                        : isFull
                          ? "cursor-not-allowed bg-gray-400 shadow-none grayscale"
                          : "cursor-pointer bg-amber-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:bg-amber-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                    }`}
                  >
                    <span className="font-bold tracking-wider">
                      {isCurrent ? "참여중" : isFull ? "FULL" : "입장"}
                    </span>
                    {!isFull && !isCurrent && <LogIn className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
