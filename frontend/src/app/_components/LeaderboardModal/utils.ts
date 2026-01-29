import type { PlayerRankRes } from "@/lib/api/point";
import type { LeaderboardPlayer } from "./types";
import { getGithubAvatarUrl } from "@/utils/github";

// 순위에 따른 텍스트 색상
export function getRankTextColor(rank: number): string {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-[#CD7F32]";
  return "text-amber-900";
}

// 순위 표시 텍스트
export function getRankDisplay(rank: number): string | number {
  return rank <= 3 ? `No.${rank}` : rank;
}

// 시즌 종료까지 남은 시간 계산
export function calculateSeasonRemaining(endTime: string) {
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

// 시간을 두 자리로 포맷
export function formatTime(n: number): string {
  return String(n).padStart(2, "0");
}

// 백엔드 PlayerRankRes를 프론트엔드 LeaderboardPlayer로 변환
export function toLeaderboardPlayer(rank: PlayerRankRes): LeaderboardPlayer {
  return {
    playerId: rank.playerId,
    rank: rank.rank,
    username: rank.nickname,
    profileImage: getGithubAvatarUrl(rank.nickname),
    points: rank.totalPoints,
  };
}

// 내 랭킹 정보 생성
export function toMyRankPlayer(
  ranks: PlayerRankRes[],
  playerId: number | undefined,
  username: string | undefined,
): LeaderboardPlayer {
  const myRank = ranks.find((rank) => rank.playerId === playerId);

  if (myRank) {
    return toLeaderboardPlayer(myRank);
  }

  return {
    playerId: playerId || 0,
    rank: ranks.length + 1,
    username: username || "Unknown",
    profileImage: username ? getGithubAvatarUrl(username) : null,
    points: 0,
  };
}
