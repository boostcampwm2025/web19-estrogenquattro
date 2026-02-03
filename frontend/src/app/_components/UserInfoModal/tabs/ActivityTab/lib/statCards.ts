import { GithubEventsRes } from "@/lib/api";
import { STAT_CARD_CONFIG } from "../constants/constants";
import { StatCardData, ValueKey } from "../types/types";

export function getStatCards(
  focusTimeStr: string,
  taskCount: number,
  githubEvents: GithubEventsRes | undefined,
): StatCardData[] {
  const valueMap: Record<ValueKey, string> = {
    focusTime: focusTimeStr,
    task: String(taskCount),
    commit: String(githubEvents?.committed ?? 0),
    issue: String(githubEvents?.issueOpened ?? 0),
    prCreated: String(githubEvents?.prCreated ?? 0),
    prReviewed: String(githubEvents?.prReviewed ?? 0),
  };

  return STAT_CARD_CONFIG.map((config) => ({
    title: config.title,
    value: valueMap[config.valueKey],
    type: config.type,
  }));
}
