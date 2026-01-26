import type { LeaderboardPlayer } from "./types";
import { getRankTextColor, getRankDisplay } from "./utils";

interface PlayerRowProps {
  player: LeaderboardPlayer;
  className?: string;
  isMyRank?: boolean;
}

export default function PlayerRow({
  player,
  className = "",
  isMyRank = false,
}: PlayerRowProps) {
  const rankTextColor = getRankTextColor(player.rank);
  const rankDisplay = getRankDisplay(player.rank);

  // 기본 스타일
  const baseClasses = "grid grid-cols-4 items-center gap-2 py-2 rounded border-2";
  
  // 랭크 및 내 순위 여부에 따른 스타일 분기
  const variantClasses = isMyRank
    ? "border-blue-400 bg-blue-50"
    : "border-amber-900/20 bg-amber-50 mb-2";

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`}>
      <span className={`text-center text-lg font-bold ${rankTextColor}`}>
        {rankDisplay}
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
  );
}
