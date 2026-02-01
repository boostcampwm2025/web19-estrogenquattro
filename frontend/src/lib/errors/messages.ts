export const ERROR_MESSAGES: Record<string, string> = {
  // Task 관련
  TASK_FOCUSING: "집중 중인 태스크는 삭제할 수 없습니다.",
  TASK_NOT_FOUND: "태스크를 찾을 수 없습니다.",
  TASK_NOT_OWNED: "본인의 태스크만 삭제할 수 있습니다.",
};

/**
 * 에러 코드에 해당하는 메시지를 반환
 * @param code 에러 코드
 * @param fallback 기본 메시지 (코드가 없을 때)
 */
export function getErrorMessage(
  code: string | undefined,
  fallback: string = "알 수 없는 오류가 발생했습니다.",
): string {
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return fallback;
}
