import i18next from "i18next";

/**
 * [로컬 타임존 기준] YYYY-MM-DD 형식의 날짜 문자열 반환
 * - 사용자가 선택한 날짜를 API에 전달할 때 사용
 * - 캘린더 UI에서 사용자가 클릭한 날짜를 처리할 때 사용
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 로컬 타임존 기준으로 특정 날짜의 하루 범위를 UTC ISO8601 형식으로 반환
 * 사용자가 "오늘"이라고 생각하는 날짜의 시작/끝을 서버에 전송할 때 사용
 *
 * 예: 한국 시간 2026-01-28 하루 →
 *     startAt: 2026-01-27T15:00:00.000Z (28일 00:00:00 KST)
 *     endAt: 2026-01-28T14:59:59.999Z (28일 23:59:59 KST)
 *
 * @param date - 로컬 타임존 기준 날짜
 * @returns startAt: 해당 날짜 00:00:00의 UTC ISO8601, endAt: 해당 날짜 23:59:59.999의 UTC ISO8601
 */
export function getLocalDayRange(date: Date): {
  startAt: string;
  endAt: string;
} {
  // 로컬 타임존 기준으로 00:00:00
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  // 로컬 타임존 기준으로 23:59:59.999
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  // toISOString()은 자동으로 UTC로 변환해서 반환
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

/**
 * 오늘 로컬 날짜의 자정 시각을 UTC ISO8601 형식으로 반환
 * 웹소켓 이벤트 전송 시 사용 (joining, focusing, resting)
 *
 * 예: 한국 시간 2026-01-28 00:00:00 → UTC 2026-01-27T15:00:00.000Z
 *
 * @returns 오늘 로컬 자정의 UTC ISO8601 문자열
 */
export function getTodayStartTime(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

/**
 * YYYY-MM-DD 문자열을 로컬 타임존 자정의 Date 객체로 변환
 * new Date("2026-01-28")은 UTC 자정으로 해석되므로, 로컬 자정으로 해석하려면 T00:00:00을 붙여야 함
 *
 * @param dateStr - YYYY-MM-DD 형식의 날짜 문자열
 * @returns 로컬 타임존 자정의 Date 객체
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

/**
 * 초 단위 시간을 "⏱️ X시간 Y분" 형식으로 변환
 * @param seconds - 총 초
 * @returns 포맷된 시간 문자열
 */
export function formatFocusTime(seconds: number): string {
  const t = (key: string, opts?: Record<string, unknown>) =>
    (
      i18next.t as unknown as (
        k: string,
        o: { ns: string } & Record<string, unknown>,
      ) => string
    )(key, { ns: "game", ...opts });

  const totalMinutes = Math.floor(seconds / 60);
  let result = "⏱️";

  if (totalMinutes < 60) {
    result += t("time.minutes", { m: totalMinutes });
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (mins > 0) {
      result += t("time.hoursMinutes", { h: hours, m: mins });
    } else {
      result += t("time.hours", { h: hours });
    }
  }

  return result;
}

/**
 * Date 객체를 "YYYY년 M월 DD일 요일" 형식으로 변환
 * @param date - 포맷팅할 날짜
 * @returns 포맷된 날짜 문자열 (예: "2026년 1월 29일 수")
 */
export function formatSelectedDate(date: Date): string {
  const t = (key: string, opts?: Record<string, unknown>) =>
    (
      i18next.t as unknown as (
        k: string,
        o: { ns: string } & Record<string, unknown>,
      ) => string
    )(key, { ns: "game", ...opts });

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = String(date.getDate()).padStart(2, "0");
  const weekdays = i18next.store?.data?.[i18next.language]?.game as
    | Record<string, unknown>
    | undefined;
  const weekdayList = (weekdays?.date as Record<string, unknown> | undefined)
    ?.weekdays as string[] | undefined;
  const weekday = weekdayList?.[date.getDay()] ?? "";

  return t("date.format", { year, month, day, weekday });
}

/**
 * 이번 주 월요일 00:00:00 (로컬 타임존)을 UTC ISO8601로 반환
 * 리더보드 주간 랭킹 조회 시 사용
 *
 * 예: 한국 시간 2026-01-29 (수요일) 기준 →
 *     이번주 월요일: 2026-01-27 00:00:00 KST → 2026-01-26T15:00:00.000Z (UTC)
 *
 * @returns 이번 주 월요일 로컬 자정의 UTC ISO8601 문자열
 */
export function getThisWeekMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0(일) ~ 6(토)
  const diff = day === 0 ? -6 : 1 - day; // 월요일까지의 차이 (일요일이면 -6, 아니면 1-day)
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0); // 로컬 타임존 기준 자정
  return monday.toISOString(); // UTC로 변환
}

/**
 * 다음 월요일 00:00:00 (로컬 타임존)을 UTC ISO8601로 반환
 * 시즌 종료 시간 계산 시 사용
 *
 * @returns 다음 주 월요일 로컬 자정의 UTC ISO8601 문자열
 */
export function getNextMonday(): string {
  const thisMonday = new Date(getThisWeekMonday());
  thisMonday.setDate(thisMonday.getDate() + 7);
  return thisMonday.toISOString();
}
