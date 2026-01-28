import type { LeaderboardResponse } from "./types";

// 목업 API 응답 생성 함수 (실제 API 연동 시 대체)
export function getMockResponse(): LeaderboardResponse {
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
    myRank: {
      rank: 1,
      username: "ldh-dodo",
      profileImage: "https://github.com/ldh-dodo.png",
      points: 131,
    },
  };
}
