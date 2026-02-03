import { fetchApi } from "./client";

export interface GithubEventsRes {
  startAt: string;
  endAt: string;
  prCreated: number;
  prReviewed: number;
  committed: number;
  issueOpened: number;
}



export interface GithubUserDetail {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  followers: number;
  following: number;
  name: string | null;
  bio: string | null;
}

export interface FollowStatusRes {
  isFollowing: boolean;
}

export interface FollowActionRes {
  success: boolean;
}



export const githubApi = {
  /** 일별 GitHub 이벤트 조회 */
  getEvents: (playerId: number, startAt: string, endAt: string) =>
    fetchApi<GithubEventsRes>(
      `/api/github/events?playerId=${playerId}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`,
    ),

  /** GitHub 유저 정보 조회 */
  getUser: (username: string) =>
    fetchApi<GithubUserDetail>(`/api/github/users/${username}`),


  /** 팔로우 상태 확인 */
  getFollowStatus: (username: string) =>
    fetchApi<FollowStatusRes>(`/api/github/users/${username}/follow-status`),

  /** 팔로우 */
  followUser: (username: string) =>
    fetchApi<FollowActionRes>(`/api/github/users/${username}/follow`, {
      method: "PUT",
    }),

  /** 언팔로우 */
  unfollowUser: (username: string) =>
    fetchApi<FollowActionRes>(`/api/github/users/${username}/follow`, {
      method: "DELETE",
    }),


};
