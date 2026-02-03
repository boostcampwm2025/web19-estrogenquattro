import { Task } from "@/app/_components/TasksMenu/types";
import { toDateString } from "@/utils/timeFormat";

/**
 * 특정 날짜의 Task들을 필터링
 */
export function getTasksByDate(tasks: Task[], date: Date): Task[] {
  const targetDateStr = toDateString(date);

  return tasks.filter((task) => {
    const taskDateStr = toDateString(new Date(task.createdAt));
    return taskDateStr === targetDateStr;
  });
}

/**
 * 시간(초)을 HH:MM:SS 형식으로 변환
 */
export function formatTimeFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
