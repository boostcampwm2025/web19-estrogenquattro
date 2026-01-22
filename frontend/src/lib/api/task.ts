import { fetchApi } from "./client";

export interface TaskRes {
  id: number;
  description: string;
  totalFocusMinutes: number;
  isCompleted: boolean;
  createdDate: string;
}

export interface TaskListRes {
  tasks: TaskRes[];
}

export const taskApi = {
  getTasks: (playerId: number, date?: string) =>
    fetchApi<TaskListRes>(
      `/api/tasks/${playerId}${date ? `?date=${date}` : ""}`,
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
