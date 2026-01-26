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