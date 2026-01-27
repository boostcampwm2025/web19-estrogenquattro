export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 오늘의 범위를 반환
 * 시작: 오늘 UTC 15:00
 * 끝: 내일 UTC 14:59:59.999
 */
export function getTodayRange(): DateRange {
  const now = new Date();

  const start = new Date(now);
  start.setUTCHours(15, 0, 0, 0);

  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(14, 59, 59, 999);

  return { start, end };
}

/**
 * 어제의 범위를 반환 (UTC 15시에 호출되는 스케줄러용)
 * 시작: 어제 UTC 15:00
 * 끝: 오늘 UTC 14:59:59.999
 */
export function getYesterdayRange(): DateRange {
  const now = new Date();

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(15, 0, 0, 0);

  const end = new Date(now);
  end.setUTCHours(14, 59, 59, 999);

  return { start, end };
}