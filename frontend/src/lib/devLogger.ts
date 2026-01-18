type LogArgs = unknown[];

function shouldLog() {
  return process.env.NODE_ENV === "development";
}

export const devLogger = {
  error: (...args: LogArgs) => {
    if (!shouldLog()) return;
    console.error(...args);
  },
  warn: (...args: LogArgs) => {
    if (!shouldLog()) return;
    console.warn(...args);
  },
  info: (...args: LogArgs) => {
    if (!shouldLog()) return;
    console.info(...args);
  },
  log: (...args: LogArgs) => {
    if (!shouldLog()) return;
    console.log(...args);
  },
};
