import { GIT_EVENT_TYPES } from "@/lib/api";

export const STAT_CARD_TYPES = {
  TASK: "TASK",
  ...GIT_EVENT_TYPES,
} as const;

export type StatCardType =
  (typeof STAT_CARD_TYPES)[keyof typeof STAT_CARD_TYPES];

export const STAT_CARD_CONFIG = [
  { title: "집중시간", valueKey: "focusTime", type: null },
  { title: "TASK", valueKey: "task", type: STAT_CARD_TYPES.TASK },
  { title: "Commit", valueKey: "commit", type: STAT_CARD_TYPES.COMMITTED },
  { title: "ISSUE", valueKey: "issue", type: STAT_CARD_TYPES.ISSUE_OPEN },
  { title: "PR 생성", valueKey: "prCreated", type: STAT_CARD_TYPES.PR_OPEN },
  {
    title: "PR 리뷰",
    valueKey: "prReviewed",
    type: STAT_CARD_TYPES.PR_REVIEWED,
  },
] as const;
