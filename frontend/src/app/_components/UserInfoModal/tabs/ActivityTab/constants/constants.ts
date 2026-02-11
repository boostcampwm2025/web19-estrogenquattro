import { GIT_EVENT_TYPES } from "@/lib/api";

export const STAT_CARD_TYPES = {
  TASK: "TASK",
  ...GIT_EVENT_TYPES,
} as const;

export type StatCardType =
  (typeof STAT_CARD_TYPES)[keyof typeof STAT_CARD_TYPES];

export const STAT_CARD_CONFIG = [
  {
    titleKey: "focusTime",
    valueKey: "focusTime",
    type: null,
  },
  {
    titleKey: "task",
    valueKey: "task",
    type: STAT_CARD_TYPES.TASK,
  },
  {
    titleKey: "commit",
    valueKey: "commit",
    type: STAT_CARD_TYPES.COMMITTED,
  },
  {
    titleKey: "issueOpen",
    valueKey: "issue",
    type: STAT_CARD_TYPES.ISSUE_OPEN,
  },
  {
    titleKey: "prOpen",
    valueKey: "prCreated",
    type: STAT_CARD_TYPES.PR_OPEN,
  },
  {
    titleKey: "prReviewed",
    valueKey: "prReviewed",
    type: STAT_CARD_TYPES.PR_REVIEWED,
  },
] as const;
