import { fetchApi } from "./client";

export interface GithubEventsRes {
  startAt: string;
  endAt: string;
  prCreated: number;
  prReviewed: number;
  committed: number;
  issueOpened: number;
}

export const githubApi = {
  /** 일별 GitHub 이벤트 조회 */
  getEvents: (playerId: number, startAt: string, endAt: string) =>
    fetchApi<GithubEventsRes>(
      `/api/github/events?playerId=${playerId}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`,
    ),
};
