import i18next from "i18next";

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
};

export function formatDate(date: Date): string {
  const locale = LOCALE_MAP[i18next.language] ?? "en-US";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function isSameDay(date1: Date, date2?: Date): boolean {
  if (!date2) return false;
  return date1.toDateString() === date2.toDateString();
}

export function getDateRange(daysAgo: number): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - daysAgo);
  return { startDate, endDate };
}
