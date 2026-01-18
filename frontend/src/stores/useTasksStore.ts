import { create } from "zustand";
import { Task, mapTaskResToTask } from "@/app/_components/TasksMenu/types";
import { taskApi } from "@/lib/api";

interface TasksStore {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;

  // API 연동 액션
  fetchTasks: (date?: string) => Promise<void>;
  addTask: (text: string) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  editTask: (id: number, newText: string) => Promise<void>;

  // 로컬 전용 액션 (타이머)
  toggleTaskTimer: (id: number) => void;
  stopAllTasks: () => void;
  incrementTaskTime: (id: number) => void;
}

export const useTasksStore = create<TasksStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async (date?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await taskApi.getTasks(date);
      const tasks = response.tasks.map(mapTaskResToTask);
      set({ tasks, isLoading: false });
    } catch {
      set({ error: "Task 목록을 불러오는데 실패했습니다.", isLoading: false });
    }
  },

  addTask: async (text: string) => {
    try {
      const response = await taskApi.createTask(text);
      const newTask = mapTaskResToTask(response);
      set((state) => ({ tasks: [...state.tasks, newTask] }));
    } catch {
      set({ error: "Task 생성에 실패했습니다." });
    }
  },

  toggleTask: async (id: number) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // 낙관적 업데이트
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t,
      ),
    }));

    try {
      if (task.completed) {
        await taskApi.uncompleteTask(id);
      } else {
        await taskApi.completeTask(id);
      }
    } catch {
      // 롤백
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, completed: task.completed } : t,
        ),
        error: "Task 상태 변경에 실패했습니다.",
      }));
    }
  },

  deleteTask: async (id: number) => {
    const { tasks } = get();
    const taskToDelete = tasks.find((t) => t.id === id);

    // 낙관적 업데이트
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));

    try {
      await taskApi.deleteTask(id);
    } catch {
      // 롤백
      if (taskToDelete) {
        set((state) => ({
          tasks: [...state.tasks, taskToDelete],
          error: "Task 삭제에 실패했습니다.",
        }));
      }
    }
  },

  editTask: async (id: number, newText: string) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const oldText = task.text;

    // 낙관적 업데이트
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, text: newText } : t,
      ),
    }));

    try {
      await taskApi.updateTask(id, newText);
    } catch {
      // 롤백
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, text: oldText } : t,
        ),
        error: "Task 수정에 실패했습니다.",
      }));
    }
  },

  toggleTaskTimer: (id: number) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? { ...task, isRunning: !task.isRunning }
          : { ...task, isRunning: false },
      ),
    })),

  stopAllTasks: () =>
    set((state) => ({
      tasks: state.tasks.map((task) => ({ ...task, isRunning: false })),
    })),

  incrementTaskTime: (id: number) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, time: task.time + 1 } : task,
      ),
    })),
}));
