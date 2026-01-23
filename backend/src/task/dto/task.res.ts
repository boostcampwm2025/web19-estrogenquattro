import { Task } from '../entites/task.entity';

export class TaskRes {
  id: number;
  description: string;
  totalFocusSeconds: number;
  isCompleted: boolean;
  createdDate: string;

  static of(task: Task): TaskRes {
    const res = new TaskRes();
    res.id = task.id;
    res.description = task.description;
    res.totalFocusSeconds = task.totalFocusSeconds;
    res.isCompleted = task.completedDate !== null;
    res.createdDate = task.createdDate;
    return res;
  }
}
