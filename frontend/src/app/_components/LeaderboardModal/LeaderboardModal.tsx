"use client";

import { useModalStore, MODAL_TYPES } from "@/stores/useModalStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useMemo, useState } from "react";
import { useLeaderboard } from "@/lib/api/hooks";
import { getThisWeekMonday, getNextMonday } from "@/utils/timeFormat";
import { useAuthStore } from "@/stores/authStore";
import {
  POINT_TYPES,
  POINT_TYPE_LABELS,
  POINT_TYPE_BADGE_NAMES,
  type PointType,
} from "@/lib/api";

import type { LeaderboardResponse } from "./types";
import {
  calculateSeasonRemaining,
  formatTime,
  toLeaderboardPlayerFromTotal,
  toLeaderboardPlayerFromActivity,
  toMyRankPlayerFromTotal,
  toMyRankPlayerFromActivity,
} from "./utils";
import type { TotalRankRes, ActivityRankRes } from "@/lib/api/point";
import PlayerRow from "./PlayerRow";
import { Sparkles } from "lucide-react";

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
  const [selectedTab, setSelectedTab] = useState<PointType>(POINT_TYPES.ALL);
  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  const user = useAuthStore((state) => state.user);
  const weekendStartAt = useMemo(() => getThisWeekMonday(), []);

  // 리더보드 데이터 (모달이 열릴 때만 API 호출)
  const { ranks, isLoading } = useLeaderboard(
    weekendStartAt,
    selectedTab,
    isOpen,
  );

  // 캐시된 리더보드 데이터 (탭 전환 시 깜박임 방지)
  const [cachedData, setCachedData] = useState<LeaderboardResponse | null>(
    null,
  );

  // 백엔드 응답을 프론트엔드 타입으로 변환 (데이터 도착 시에만 업데이트)
  useEffect(() => {
    if (!isOpen) return;
    if (isLoading) return;
    if (!ranks) return; // undefined/null만 체크 (빈 배열은 유효 데이터)

    const isAll = selectedTab === POINT_TYPES.ALL;
    const newData: LeaderboardResponse = {
      seasonEndTime: getNextMonday(),
      players: isAll
        ? (ranks as TotalRankRes[]).map(toLeaderboardPlayerFromTotal)
        : (ranks as ActivityRankRes[]).map(toLeaderboardPlayerFromActivity),
      myRank: isAll
        ? toMyRankPlayerFromTotal(
            ranks as TotalRankRes[],
            user?.playerId,
            user?.username,
          )
        : toMyRankPlayerFromActivity(
            ranks as ActivityRankRes[],
            user?.playerId,
            user?.username,
          ),
    };
    setCachedData(newData);
  }, [isOpen, isLoading, ranks, user, selectedTab]);

  // 모달 닫을 때 캐시 초기화
  useEffect(() => {
    if (!isOpen) {
      setCachedData(null);
    }
  }, [isOpen]);

  // 시즌 타이머 계산 (tick 변경 시 재계산)
  const seasonTime = useMemo(() => {
    if (!cachedData) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    return calculateSeasonRemaining(cachedData.seasonEndTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedData, tick]);

  // 시즌 타이머 업데이트 (백엔드에서 시즌 종료일을 알려주면, 프론트엔드에서 역산할 듯)
  useEffect(() => {
    if (!isOpen || !cachedData) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, cachedData]);

  if (!isOpen || !cachedData) return null;

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
            주간 순위표
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

        {/* 탭 메뉴 */}
        <div className="mb-4">
          <div className="flex flex-wrap justify-center gap-1.5">
            {Object.entries(POINT_TYPES).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setSelectedTab(value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    setSelectedTab(value);
                  }
                }}
                className={`${PIXEL_BORDER} w-[calc(25%-0.375rem)] cursor-pointer py-2.5 text-sm font-bold whitespace-nowrap transition-all ${
                  selectedTab === value
                    ? "translate-y-[1px] bg-amber-700 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.4)]"
                    : "bg-white text-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:bg-amber-50 active:translate-y-[1px]"
                }`}
              >
                {POINT_TYPE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        {/* 주간 순위 */}
        <div
          className={`${PIXEL_BORDER} relative overflow-hidden bg-white/50 p-3`}
        >
          {/* 대각선 스트라이프 배경 - 전체 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-5"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                #d4a574 10px,
                #d4a574 20px
              )`,
            }}
          />

          <h3 className="relative mb-3 flex items-center justify-center gap-3 py-3 text-center text-lg font-bold text-amber-900">
            <Sparkles className="h-4 w-4 animate-pulse text-amber-600" />
            <span>{POINT_TYPE_BADGE_NAMES[selectedTab]}</span>
            <Sparkles className="h-4 w-4 animate-pulse text-amber-600" />
          </h3>

          {/* 테이블 헤더 */}
          <div className="mb-2 grid grid-cols-4 gap-2 border-b-2 border-amber-900/30 pb-2 text-sm font-bold text-amber-700">
            <span className="text-center">순위</span>
            <span className="text-center">프로필</span>
            <span className="text-center">깃허브 네임</span>
            <span className="text-center">
              {selectedTab === POINT_TYPES.ALL ||
              selectedTab === POINT_TYPES.FOCUSED
                ? "포인트"
                : "횟수"}
            </span>
          </div>

          {/* 순위 목록 (스크롤 가능) */}
          <div className="retro-scrollbar max-h-60 space-y-2 overflow-y-auto">
            {cachedData.players.length === 0 ? (
              <div className="py-8 text-center text-sm text-amber-700">
                아직 이번 주 랭킹 데이터가 없습니다.
              </div>
            ) : (
              cachedData.players.map((player) => (
                <PlayerRow key={player.playerId} player={player} />
              ))
            )}
          </div>

          {/* 내 순위 */}
          <div className="border-t-2 border-amber-900/30 pt-3">
            <PlayerRow player={cachedData.myRank} isMyRank />
          </div>
        </div>
      </div>
    </div>
  );
}
