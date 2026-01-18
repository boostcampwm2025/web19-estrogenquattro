// Task API 응답 타입
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

// API 기본 URL (개발: localhost:8080, 프로덕션: 상대 경로)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// 공통 fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  // DELETE 요청은 빈 응답일 수 있음
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

// Task API
export const taskApi = {
  getTasks: (date?: string) =>
    fetchApi<TaskListRes>(`/api/tasks${date ? `?date=${date}` : ""}`),

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
