import type { TaskEntity } from "../shared/task";

type TaskOverrides = Partial<TaskEntity>;

export const buildTaskEntity = (overrides: TaskOverrides = {}): TaskEntity => {
  const base = {
    id: 1,
    description: "기본 작업",
    totalFocusMinutes: 0,
    completedDate: null,
    createdDate: new Date("2025-01-18T00:00:00.000Z"),
  };

  return { ...base, ...overrides } as TaskEntity;
};
