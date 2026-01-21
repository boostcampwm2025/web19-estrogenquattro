/**
 * UTC 기준으로 YYYY-MM-DD 형식의 날짜 문자열 반환
 * 백엔드와 일관성을 위해 UTC 사용
 */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 초 단위 시간을 "⏱️ X시간 Y분" 형식으로 변환
 * @param seconds - 총 초
 * @returns 포맷된 시간 문자열
 */
export function formatFocusTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  let result = "⏱️";

  if (totalMinutes < 60) {
    result += `${totalMinutes}분`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    result += `${hours}시간`;
    if (mins > 0) {
      result += ` ${mins}분`;
    }
  }

  return result;
}
