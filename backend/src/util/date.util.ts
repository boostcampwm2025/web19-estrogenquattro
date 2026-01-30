export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 어제의 범위를 반환 (UTC 15시에 호출되는 스케줄러용)
 * 시작: 어제 UTC 15:00
 * 끝: 오늘 UTC 14:59:59.999
 */
export function getYesterdayKstRange(): DateRange {
  const now = new Date();

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(15, 0, 0, 0);

  const end = new Date(now);
  end.setUTCHours(14, 59, 59, 999);

  return { start, end };
}

export function getTodayKstRangeUtc(): { start: Date; end: Date } {
  const now = new Date();

  // 현재 시각을 KST 기준으로 맞춘 뒤 날짜만 사용
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const day = kst.getUTCDate();

  // KST 00:00 → UTC 전날 15:00
  const start = new Date(Date.UTC(year, month, day - 1, 15, 0, 0, 0));
  // KST 23:59:59.999 → UTC 당일 14:59:59.999
  const end = new Date(Date.UTC(year, month, day, 14, 59, 59, 999));

  return { start, end };
}
