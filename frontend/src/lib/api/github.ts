import { fetchApi } from "./client";

export interface GithubEventsRes {
  date: string;
  prCreated: number;
  prReviewed: number;
  committed: number;
  issueOpened: number;
}

export const githubApi = {
  /** 일별 GitHub 이벤트 조회 */
  getEvents: (date: string) =>
    fetchApi<GithubEventsRes>(`/api/github/events?date=${date}`),
};
