export interface LeaderboardPlayer {
  playerId: number;
  rank: number;
  username: string;
  profileImage: string | null;
  points: number;
}

export interface LeaderboardResponse {
  seasonEndTime: string; // ISO 8601 형식
  players: LeaderboardPlayer[]; // 상위 N명
  myRank: LeaderboardPlayer; // 내 순위
}
