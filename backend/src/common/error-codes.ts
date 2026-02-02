export const ErrorCodes = {
  // Task 관련
  TASK_FOCUSING: 'TASK_FOCUSING',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_OWNED: 'TASK_NOT_OWNED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
