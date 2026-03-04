/**
 * 콘솔 에러/경고 로그 버퍼
 *
 * console.error, console.warn을 래핑하여 최근 로그를 링 버퍼에 저장합니다.
 * 버그 제보 시 getRecentLogs()로 수집하여 함께 전송합니다.
 */

interface LogEntry {
  level: "error" | "warn";
  message: string;
  timestamp: string;
}

const MAX_LOG_SIZE = 50;
const logBuffer: LogEntry[] = [];

let isInitialized = false;

const SENSITIVE_KEY_RE =
  /(password|passwd|secret|authorization|cookie|set-cookie|token)/i;

function sanitizeMessage(raw: string): string {
  return raw
    .replace(
      /([?&](token|access_token|refresh_token|code)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
}

function toLogString(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "object" && arg !== null) {
    try {
      const seen = new WeakSet<object>();
      return JSON.stringify(arg, (key, value: unknown) => {
        if (SENSITIVE_KEY_RE.test(key)) return "[REDACTED]";
        if (typeof value === "string") return sanitizeMessage(value);
        if (value && typeof value === "object") {
          if (seen.has(value as object)) return "[Circular]";
          seen.add(value as object);
        }
        return value;
      });
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function addLog(level: LogEntry["level"], args: unknown[]) {
  const message = sanitizeMessage(args.map((arg) => toLogString(arg)).join(" ")).slice(
    0,
    2000,
  );

  logBuffer.push({
    level,
    message,
    timestamp: new Date().toISOString(),
  });

  // 링 버퍼: 최대 크기 초과 시 오래된 로그 제거
  if (logBuffer.length > MAX_LOG_SIZE) {
    logBuffer.shift();
  }
}

/**
 * 콘솔 로그 수집기 초기화.
 * 앱 시작 시 한 번만 호출해야 합니다.
 */
export function initLogBuffer() {
  if (isInitialized) return;
  isInitialized = true;

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    addLog("error", args);
    originalError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    addLog("warn", args);
    originalWarn.apply(console, args);
  };

  // 잡히지 않은 에러도 수집
  if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
      addLog("error", [
        `[Uncaught] ${event.message} at ${event.filename}:${event.lineno}`,
      ]);
    });

    window.addEventListener("unhandledrejection", (event) => {
      addLog("error", [`[Unhandled Rejection] ${event.reason}`]);
    });
  }
}

/**
 * 최근 로그 목록 반환 (복사본)
 */
export function getRecentLogs(): LogEntry[] {
  return [...logBuffer];
}
