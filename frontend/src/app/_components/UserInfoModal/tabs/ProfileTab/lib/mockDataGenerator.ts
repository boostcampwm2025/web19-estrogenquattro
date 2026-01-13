import { Task } from "@/app/_components/TasksMenu/types";
import { getDateRange } from "./dateUtils";

export function generateMockTasks(daysCount: number = 30): Task[] {
  const tasks: Task[] = [];
  const { startDate, endDate } = getDateRange(daysCount);

  let taskId = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const taskCount = Math.floor(Math.random() * 26);
    for (let i = 0; i < taskCount; i++) {
      tasks.push({
        id: `${taskId++}`,
        text: `Task ${taskId}`,
        completed: Math.random() > 0.5,
        time: 0,
        date: new Date(d),
      });
    }
  }
  return tasks;
}
