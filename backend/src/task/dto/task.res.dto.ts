import { Task } from '../entites/task.entity';

export class TaskRes {
  id: number;
  description: string;
  durationMinutes: number;
  isCompleted: boolean;
  createdDate: string;

  static of(task: Task): TaskRes {
    const res = new TaskRes();
    res.id = task.id;
    res.description = task.description;
    res.durationMinutes = task.durationMinutes;
    res.isCompleted = task.completedDate !== null;
    res.createdDate = new Date(task.createdDate).toISOString().split('T')[0];
    return res;
  }
}
