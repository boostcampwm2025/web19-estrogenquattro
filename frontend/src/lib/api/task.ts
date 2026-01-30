import { fetchApi } from "./client";

export interface TaskRes {
  id: number;
  description: string;
  totalFocusSeconds: number;
  isCompleted: boolean;
  createdAt: string;
}

export interface TaskListRes {
  tasks: TaskRes[];
}

export const taskApi = {
  getTasks: (
    playerId: number,
    isToday: boolean,
    startAt?: string,
    endAt?: string,
  ) =>
    fetchApi<TaskListRes>(
      `/api/tasks/${playerId}?isToday=${isToday}${startAt && endAt ? `&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}` : ""}`,
    ),

  createTask: (description: string) =>
    fetchApi<TaskRes>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ description }),
    }),

  updateTask: (taskId: number, description: string) =>
    fetchApi<TaskRes>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ description }),
    }),

  completeTask: (taskId: number) =>
    fetchApi<TaskRes>(`/api/tasks/completion/${taskId}`, {
      method: "PATCH",
    }),

  uncompleteTask: (taskId: number) =>
    fetchApi<TaskRes>(`/api/tasks/uncompletion/${taskId}`, {
      method: "PATCH",
    }),

  deleteTask: (taskId: number) =>
    fetchApi<void>(`/api/tasks/${taskId}`, {
      method: "DELETE",
    }),
};
