import i18next from "i18next";

const ERROR_CODE_TO_KEY: Record<string, string> = {
  TASK_FOCUSING: "taskFocusing",
  TASK_NOT_FOUND: "taskNotFound",
  TASK_NOT_OWNED: "taskNotOwned",
};

/**
 * 에러 코드에 해당하는 i18n 메시지를 반환
 * @param code 에러 코드
 * @param fallback 기본 메시지 (코드가 없을 때)
 */
export function getErrorMessage(
  code: string | undefined,
  fallback?: string,
): string {
  if (code && code in ERROR_CODE_TO_KEY) {
    const key = ERROR_CODE_TO_KEY[code];
    return i18next.t(($: { error: Record<string, string> }) => $.error[key], {
      ns: "common",
    });
  }
  return (
    fallback ??
    i18next.t(
      ($: { error: { unknownError: string } }) => $.error.unknownError,
      { ns: "common" },
    )
  );
}
