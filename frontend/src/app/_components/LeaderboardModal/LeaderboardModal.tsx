"use client";

import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useMemo, useState } from "react";
import { useLeaderboard } from "@/lib/api/hooks";
import { getThisWeekMonday, getNextMonday } from "@/utils/timeFormat";
import { useAuthStore } from "@/stores/authStore";

import type { LeaderboardResponse } from "./types";
import {
  calculateSeasonRemaining,
  formatTime,
  toLeaderboardPlayer,
  toMyRankPlayer,
} from "./utils";
import PlayerRow from "./PlayerRow";

const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";

export default function LeaderboardModal() {
  const { activeModal, closeModal } = useModalStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
    })),
  );
  const isOpen = activeModal === MODAL_TYPES.LEADERBOARD;

  const [tick, setTick] = useState(0);
  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const user = useAuthStore((state) => state.user);
  const weekendStartAt = useMemo(() => getThisWeekMonday(), []);
  const { ranks, isLoading } = useLeaderboard(weekendStartAt);

  // 백엔드 응답을 프론트엔드 타입으로 변환
  const leaderboardData = useMemo<LeaderboardResponse | null>(() => {
    if (!isOpen || isLoading) return null;

    return {
      seasonEndTime: getNextMonday(),
      players: ranks.map(toLeaderboardPlayer),
      myRank: toMyRankPlayer(ranks, user?.playerId, user?.username),
    };
  }, [isOpen, isLoading, ranks, user]);

  // 시즌 타이머 계산 (tick 변경 시 재계산)
  const seasonTime = useMemo(() => {
    if (!leaderboardData) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    return calculateSeasonRemaining(leaderboardData.seasonEndTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardData, tick]);

  // 시즌 타이머 업데이트 (백엔드에서 시즌 종료일을 알려주면, 프론트엔드에서 역산할 듯)
  useEffect(() => {
    if (!isOpen || !leaderboardData) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, leaderboardData]);

  if (!isOpen || !leaderboardData) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        className={`relative w-full max-w-lg ${PIXEL_BG} ${PIXEL_BORDER} p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="leaderboard-title"
            className="text-xl font-extrabold tracking-wider text-amber-900"
          >
            순위표
          </h2>
          <button
            onClick={handleClose}
            aria-label="리더보드 모달 닫기"
            className={`flex h-8 w-8 cursor-pointer items-center justify-center ${PIXEL_BORDER} bg-red-400 leading-none font-bold text-white shadow-[2px_2px_0px_0px_rgba(30,30,30,0.3)] hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`}
          >
            X
          </button>
        </div>

        {/* 시즌 타이머 */}
        <div className="mb-4 text-center">
          <p className="text-sm text-amber-700">현재 시즌 타이머</p>
          <p className="text-2xl font-bold text-amber-900">
            {seasonTime.days}day : {formatTime(seasonTime.hours)} :{" "}
            {formatTime(seasonTime.minutes)} : {formatTime(seasonTime.seconds)}
          </p>
        </div>

        {/* 주간 순위 */}
        <div className={`${PIXEL_BORDER} bg-white/50 p-3`}>
          <h3 className="mb-3 text-center text-lg font-bold text-amber-900">
            주간 순위
          </h3>

          {/* 테이블 헤더 */}
          <div className="mb-2 grid grid-cols-4 gap-2 border-b-2 border-amber-900/30 pb-2 text-sm font-bold text-amber-700">
            <span className="text-center">순위</span>
            <span className="text-center">프로필 사진</span>
            <span className="text-center">깃허브 네임</span>
            <span className="text-center">포인트</span>
          </div>

          {/* 순위 목록 (스크롤 가능) */}
          <div className="retro-scrollbar max-h-60 space-y-2 overflow-y-auto">
            {leaderboardData.players.length === 0 ? (
              <div className="py-8 text-center text-sm text-amber-700">
                아직 이번 주 랭킹 데이터가 없습니다.
              </div>
            ) : (
              leaderboardData.players.map((player) => (
                <PlayerRow key={player.playerId} player={player} />
              ))
            )}
          </div>

          {/* 내 순위 */}
          <div className="border-t-2 border-amber-900/30 pt-3">
            <PlayerRow player={leaderboardData.myRank} isMyRank />
          </div>
        </div>
      </div>
    </div>
  );
}
