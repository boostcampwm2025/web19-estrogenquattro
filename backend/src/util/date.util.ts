const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * KST 기준 특정 날짜의 UTC 시간 범위를 반환
 * KST 00:00 ~ 23:59:59.999 = UTC 전날 15:00 ~ 당일 14:59:59.999
 */
export function getKstDateRange(dateStr: string): DateRange {
  const [year, month, day] = dateStr.split('-').map(Number);

  // KST 해당 날짜 00:00 = UTC 전날 15:00
  const start = new Date(Date.UTC(year, month - 1, day - 1, 15, 0, 0, 0));

  // KST 해당 날짜 23:59:59.999 = UTC 당일 14:59:59.999
  const end = new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999));

  return { start, end };
}

/**
 * 오늘 KST 날짜를 YYYY-MM-DD 문자열로 반환
 */
export function getTodayKstDateString(): string {
  const now = new Date();
  const kstDate = new Date(now.getTime() + KST_OFFSET_MS);
  return kstDate.toISOString().slice(0, 10);
}

/**
 * KST 기준 오늘의 UTC 시간 범위를 반환
 */
export function getTodayKstRange(): DateRange {
  const now = new Date();
  const kstDate = new Date(now.getTime() + KST_OFFSET_MS);
  const [year, month, day] = [
    kstDate.getUTCFullYear(),
    kstDate.getUTCMonth(),
    kstDate.getUTCDate(),
  ];

  // KST 오늘 00:00 = UTC 어제 15:00
  const start = new Date(Date.UTC(year, month, day - 1, 15, 0, 0, 0));

  // KST 오늘 23:59:59.999 = UTC 오늘 14:59:59.999
  const end = new Date(Date.UTC(year, month, day, 14, 59, 59, 999));

  return { start, end };
}

/**
 * KST 기준 어제의 UTC 시간 범위를 반환
 */
export function getYesterdayKstRange(): DateRange {
  const kstTodayStartUtc = new Date();
  kstTodayStartUtc.setUTCHours(15, 0, 0, 0);
  kstTodayStartUtc.setUTCDate(kstTodayStartUtc.getUTCDate() - 1);

  // KST 어제 00:00 = UTC 그저께 15:00
  const kstYesterdayStartUtc = new Date(kstTodayStartUtc);
  kstYesterdayStartUtc.setUTCDate(kstYesterdayStartUtc.getUTCDate() - 1);

  // KST 어제 23:59:59.999 = UTC 어제 14:59:59.999
  const kstYesterdayEndUtc = new Date(kstTodayStartUtc);
  kstYesterdayEndUtc.setUTCMilliseconds(-1);

  return { start: kstYesterdayStartUtc, end: kstYesterdayEndUtc };
}
