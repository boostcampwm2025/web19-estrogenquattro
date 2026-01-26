"use client";

import { useLeaderboardStore } from "@/stores/leaderboardStore";
import { useModalClose } from "@/hooks/useModalClose";
import { useEffect, useMemo, useState } from "react";

// Pixel Art Style Constants
const PIXEL_BORDER = "border-3 border-amber-900";
const PIXEL_BG = "bg-[#ffecb3]";

// 임시 목업 데이터 (API 응답 형태)
interface LeaderboardPlayer {
  rank: number;
  username: string;
  profileImage: string | null;
  points: number;
}

interface LeaderboardResponse {
  seasonEndTime: string; // ISO 8601 형식
  players: LeaderboardPlayer[];
}

// 목업 API 응답 생성 함수 (실제 API 연동 시 대체)
function getMockResponse(): LeaderboardResponse {
  return {
    seasonEndTime: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 + 0 * 60 * 60 * 1000 + 0 * 60 * 1000,
    ).toISOString(),
    players: [
      {
        rank: 1,
        username: "ldh-dodo",
        profileImage: "https://github.com/ldh-dodo.png",
        points: 131,
      },
      {
        rank: 2,
        username: "heisjun",
        profileImage: "https://github.com/heisjun.png",
        points: 98,
      },
      {
        rank: 3,
        username: "songhaechan",
        profileImage: "https://github.com/songhaechan.png",
        points: 76,
      },
      {
        rank: 4,
        username: "honki12345",
        profileImage: "https://github.com/honki12345.png",
        points: 54,
      },
    ],
  };
}

// 시즌 종료까지 남은 시간 계산
function calculateSeasonRemaining(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

export default function LeaderboardModal() {
  const { isOpen, closeModal } = useLeaderboardStore();
  const [tick, setTick] = useState(0);
  const { contentRef, handleClose, handleBackdropClick } = useModalClose({
    isOpen,
    onClose: closeModal,
  });

  // 모달이 열릴 때 데이터 로드 (목업) - useMemo로 처리
  const leaderboardData = useMemo<LeaderboardResponse | null>(() => {
    if (!isOpen) return null;
    // 실제 API 호출로 대체: 이후 TanStack Query로 대체
    return getMockResponse();
  }, [isOpen]);

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

  const formatTime = (n: number) => String(n).padStart(2, "0");

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
            {seasonTime.days}D : {formatTime(seasonTime.hours)} :{" "}
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

          {/* 순위 목록 */}
          <div className="space-y-2">
            {leaderboardData.players.map((player) => (
              <div
                key={player.rank}
                className={`grid grid-cols-4 items-center gap-2 rounded border-2 border-amber-900/20 bg-amber-50 py-2 ${
                  player.rank === 1 ? "border-amber-500 bg-amber-100" : ""
                }`}
              >
                <span className="text-center text-lg font-bold text-amber-900">
                  {player.rank}
                </span>
                <div className="flex justify-center">
                  {player.profileImage ? (
                    <img
                      src={player.profileImage}
                      alt={player.username}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-400 text-sm font-bold text-white">
                      {player.username.slice(0, 2)}
                    </div>
                  )}
                </div>
                <span className="text-center font-medium text-amber-900">
                  {player.username}
                </span>
                <span className="text-center font-bold text-amber-900">
                  {player.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
