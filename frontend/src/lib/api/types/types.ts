import { GIT_EVENT_TYPES } from "../constants/constants";

export type GitEventType =
  (typeof GIT_EVENT_TYPES)[keyof typeof GIT_EVENT_TYPES];

export interface GitEventHistoryRes {
  id: number;
  type: GitEventType;
  amount: number;
  repository: string | null;
  description: string | null;
  createdAt: string; // ISO8601 UTC 문자열
  activityAt: string | null; // ISO8601 UTC 문자열 (실제 GitHub 활동 시간)
}
