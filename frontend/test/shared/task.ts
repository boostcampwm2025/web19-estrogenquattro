import type { TaskRes } from "../../src/lib/api";

export type TaskEntity = {
  id: number;
  description: string;
  totalFocusMinutes: number;
  completedDate: Date | null;
  createdDate: Date;
};

export const toDateString = (value: Date) =>
  value.toISOString().split("T")[0];

export const toTaskRes = (task: TaskEntity): TaskRes => ({
  id: task.id,
  description: task.description,
  totalFocusMinutes: task.totalFocusMinutes,
  isCompleted: task.completedDate !== null,
  createdDate: toDateString(new Date(task.createdDate)),
});
