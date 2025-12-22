/**
 * 분 단위 시간을 "접속 시간: X시간 Y분" 형식으로 변환
 * @param minutes - 총 분
 * @returns 포맷된 시간 문자열
 */
export function formatPlayTime(minutes: number): string {
  let result = "접속 시간: ";

  if (minutes < 60) {
    result += `${minutes}분`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    result += `${hours}시간`;
    if (mins > 0) {
      result += ` ${mins}분`;
    }
  }

  return result;
}
