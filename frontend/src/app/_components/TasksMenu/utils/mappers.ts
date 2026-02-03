import { TaskRes } from "@/lib/api";
import { Task } from "../types";

export function mapTaskResToTask(res: TaskRes): Task {
  return {
    id: res.id,
    description: res.description,
    completed: res.isCompleted,
    time: res.totalFocusSeconds,
    baseTime: res.totalFocusSeconds,
    startTimestamp: null,
    isRunning: false,
    createdAt: res.createdAt,
  };
}
