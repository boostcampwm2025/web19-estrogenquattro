import { STAT_CARD_CONFIG, StatCardType } from "../constants/constants";

export type StatCardTitleKey = (typeof STAT_CARD_CONFIG)[number]["titleKey"];

export type StatCardData = {
  titleKey: StatCardTitleKey;
  value: string;
  type: StatCardType | null;
};

export type ValueKey = (typeof STAT_CARD_CONFIG)[number]["valueKey"];
