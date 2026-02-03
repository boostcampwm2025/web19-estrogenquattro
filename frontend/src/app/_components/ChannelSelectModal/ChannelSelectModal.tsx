"use client";

import { useState, useEffect } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { Users, LogIn } from "lucide-react";
import { getSocket } from "@/lib/socket";

import { useRoomStore } from "@/stores/useRoomStore";
import { useRoomSystem } from "@/lib/api/hooks/useRoomSystem";
import { RoomInfo } from "@/lib/api/room";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";

interface Channel {
  id: number;
  roomId: string; // "room-1"
  name: string; // "CH.1"
  count: number;
  max: number;
}

export default function ChannelSelectModal() {
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );
  const currentRoomIds = useRoomStore((state) => state.roomId).split("-");
  const currentRoomNum = currentRoomIds.length > 1 ? currentRoomIds[1] : "";

  const isOpen = activeModal === MODAL_TYPES.CHANNEL_SELECT;
  const [channels, setChannels] = useState<Channel[]>([]);

  // Room 시스템 훅 사용 (React Query 기반) - 모달이 열려있을 때만 데이터를 가져옴
  const { rooms, joinRoom } = useRoomSystem({ enabled: isOpen });

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  // 방 목록 데이터가 변경되면 채널 목록 상태 업데이트
  useEffect(() => {
    if (isOpen && rooms) {
      const channelList: Channel[] = Object.values(rooms).map(
        (room: RoomInfo) => {
          const num = parseInt(room.id.split("-")[1], 10);
          return {
            id: num,
            roomId: room.id,
            name: `CH.${num}`,
            count: room.size,
            max: room.capacity,
          };
        },
      );
      // ID 기준 정렬
      channelList.sort((a, b) => a.id - b.id);
      setChannels(channelList);
    }
  }, [isOpen, rooms]);

  if (!isOpen) return null;

  const handleChannelSelect = async (channel: Channel) => {
    try {
      // 1. 방 예약 (API 호출 via Hook)
      await joinRoom(channel.roomId);

      // 2. 예약된 방 ID 설정 및 소켓 전환 (재연결)
      useRoomStore.getState().setPendingRoomId(channel.roomId);
      const socket = getSocket();
      if (socket) {
        socket.disconnect(); // 소켓 연결을 끊으면 SocketManager에서 재연결 로직이 수행됨
        // 수동 연결 (일부 케이스에서 자동 연결이 안 될 수 있으므로 명시적 호출)
        socket.connect();
      }
      closeModal();
    } catch (error: any) {
      console.error("채널 이동 실패", error);
      // 409 Conflict: 방이 가득 찬 경우 (API 에러 핸들링은 client.ts에서 일부 처리되지만, 추가 처리가 필요할 수 있음)
      if (error?.status === 409) {
        alert("채널이 가득 찼습니다.");
      } else {
        alert("채널 이동에 실패했습니다.");
      }
    }
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

        <div
          className={`${PIXEL_BORDER} relative overflow-hidden bg-white/50 p-3`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-5" />
          <div className="space-y-3 p-1">
            {channels.map((channel) => {
              const isFull = channel.count >= channel.max;
              const isCurrent = currentRoomNum === channel.id.toString();

              return (
                <div
                  key={channel.id}
                  className={`flex items-center justify-between p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.01] ${
                    isCurrent
                      ? "border-3 border-green-600 bg-green-50"
                      : `${PIXEL_BORDER} bg-white`
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
                      !isFull && !isCurrent && handleChannelSelect(channel)
                    }
                    disabled={isFull || isCurrent}
                    className={`flex w-24 items-center justify-center gap-2 px-4 py-2 text-white transition-all ${
                      isCurrent
                        ? "cursor-default bg-green-600 shadow-[inset_-4px_-4px_0px_0px_#15803d,inset_4px_4px_0px_0px_#86efac]"
                        : isFull
                          ? "cursor-not-allowed bg-zinc-500 shadow-[inset_-4px_-4px_0px_0px_#555,inset_4px_4px_0px_0px_#aaa]"
                          : "cursor-pointer bg-amber-500 shadow-[inset_-4px_-4px_0px_0px_#b45309,inset_4px_4px_0px_0px_#fcd34d] hover:bg-amber-400 active:shadow-[inset_4px_4px_0px_0px_#b45309]"
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
