"use client";

import { useMemo, useState } from "react";
import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { Users, LogIn, RefreshCw } from "lucide-react";
import { getSocket } from "@/lib/socket";

import { useRoomStore } from "@/stores/useRoomStore";
import { useRoomSystem } from "@/lib/api/hooks/useRoomSystem";
import { RoomInfo } from "@/lib/api/room";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("ui");
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );
  const currentRoomIds = useRoomStore((state) => state.roomId).split("-");
  const currentRoomNum = currentRoomIds.length > 1 ? currentRoomIds[1] : "";

  const isOpen = activeModal === MODAL_TYPES.CHANNEL_SELECT;
  // Room 시스템 훅 사용 (React Query 기반) - 모달이 열려있을 때만 데이터를 가져옴
  const { rooms, joinRoom, isLoading, refetch, isFetching } = useRoomSystem({
    enabled: isOpen,
  });

  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const [isRefreshAnimating, setRefreshAnimating] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshAnimating || isFetching) return;

    setRefreshAnimating(true);
    // 최소 500ms 동안 애니메이션 유지
    await Promise.all([
      refetch(),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
    setRefreshAnimating(false);
  };

  const isSpinning = isRefreshAnimating || isFetching;

  // 방 목록 데이터가 변경되면 채널 목록 상태 업데이트
  const channels = useMemo<Channel[]>(() => {
    if (!isOpen || !rooms) return [];

    const channelList = Object.values(rooms).map((room: RoomInfo) => {
      const num = parseInt(room.id.split("-")[1], 10);
      return {
        id: num,
        roomId: room.id,
        name: `CH.${num}`,
        count: room.size,
        max: room.capacity,
      };
    });

    // ID 기준 정렬
    return channelList.sort((a, b) => a.id - b.id);
  }, [isOpen, rooms]);

  if (!isOpen) return null;

  const handleChannelSelect = async (channel: Channel) => {
    try {
      // 1. 방 예약 (API 호출 via Hook)
      await joinRoom(channel.roomId);

      // 2. 예약된 방 ID 설정 및 소켓 전환 (재연결)
      // 2. 예약된 방 ID 설정
      useRoomStore.getState().setPendingRoomId(channel.roomId);

      // 3. 트랜지션 시작 이벤트 발생 (Phaser에서 수신)
      // 트랜지션(Iris Close)이 완료되면 콜백으로 소켓 재연결 수행
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("start_channel_transition", {
            detail: {
              onComplete: () => {
                const socket = getSocket();
                if (socket) {
                  socket.disconnect();
                  socket.connect();
                }
              },
            },
          }),
        );
      } else {
        // Window가 없는 환경(혹은 예외)에서는 즉시 이동
        const socket = getSocket();
        if (socket) {
          socket.disconnect();
          socket.connect();
        }
      }

      closeModal();
    } catch (error: unknown) {
      console.error(
        t(($) => $.channel.error.moveFailed),
        error,
      );
      // 409 Conflict: 방이 가득 찬 경우 (API 에러 핸들링은 client.ts에서 일부 처리되지만, 추가 처리가 필요할 수 있음)
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status: number }).status === 409
      ) {
        alert(t(($) => $.channel.error.roomFull));
      } else {
        alert(t(($) => $.channel.error.moveFailedAlert));
      }
      // 실패 시 최신 상태로 갱신하여 인원리스트 업데이트
      handleRefresh();
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
          <div className="flex items-center gap-2">
            <h2
              id="channel-select-title"
              className="text-xl font-extrabold tracking-wider text-amber-900"
            >
              {t(($) => $.channel.title)}
            </h2>

            <button
              onClick={handleRefresh}
              disabled={isSpinning}
              aria-label={t(($) => $.channel.refreshLabel)}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center text-amber-900 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <RefreshCw
                className={`h-5 w-5 ${isSpinning ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <button
            onClick={handleClose}
            aria-label={t(($) => $.channel.closeModal)}
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
                      {isCurrent
                        ? t(($) => $.channel.status.participating)
                        : isFull
                          ? t(($) => $.channel.status.full)
                          : t(($) => $.channel.status.enter)}
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
