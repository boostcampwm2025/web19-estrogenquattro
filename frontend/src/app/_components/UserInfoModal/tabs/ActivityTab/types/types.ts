import { STAT_CARD_CONFIG, StatCardType } from "../constants/constants";

export type StatCardData = {
  title: string;
  value: string;
  type: StatCardType | null;
};

export type ValueKey = (typeof STAT_CARD_CONFIG)[number]["valueKey"];
