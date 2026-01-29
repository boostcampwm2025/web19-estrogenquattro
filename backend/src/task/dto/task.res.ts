import { Task } from '../entites/task.entity';

export class TaskRes {
  id: number;
  description: string;
  totalFocusSeconds: number;
  isCompleted: boolean;
  createdAt: string;

  static of(task: Task): TaskRes {
    const res = new TaskRes();
    res.id = task.id;
    res.description = task.description;
    res.totalFocusSeconds = task.totalFocusSeconds;
    res.isCompleted = task.completedAt !== null;
    res.createdAt = task.createdAt.toISOString();
    return res;
  }
}
