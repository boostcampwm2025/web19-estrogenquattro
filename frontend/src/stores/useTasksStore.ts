import { create } from "zustand";
import { Task, mapTaskResToTask } from "@/app/_components/TasksMenu/types";
import { taskApi } from "@/lib/api";
import { devLogger } from "@/lib/devLogger";

const MAX_TASK_TEXT_LENGTH = 100;

interface TasksStore {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  pendingTaskIds: number[];

  // API 연동 액션
  fetchTasks: (date?: string) => Promise<void>;
  addTask: (text: string) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  editTask: (id: number, newText: string) => Promise<void>;
  clearError: () => void;

  // 로컬 전용 액션 (타이머)
  toggleTaskTimer: (id: number) => void;
  stopAllTasks: () => void;
  incrementTaskTime: (id: number) => void;
}

export const useTasksStore = create<TasksStore>((set, get) => {
  const isPending = (id: number) => get().pendingTaskIds.includes(id);
  const addPending = (id: number) =>
    set((state) => ({
      pendingTaskIds: state.pendingTaskIds.includes(id)
        ? state.pendingTaskIds
        : [...state.pendingTaskIds, id],
    }));
  const removePending = (id: number) =>
    set((state) => ({
      pendingTaskIds: state.pendingTaskIds.filter((taskId) => taskId !== id),
    }));

  return {
    tasks: [],
    isLoading: false,
    error: null,
    pendingTaskIds: [],
    clearError: () => set({ error: null }),

    fetchTasks: async (date?: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await taskApi.getTasks(date);
        const tasks = response.tasks.map(mapTaskResToTask);
        set({ tasks, isLoading: false });
      } catch (error) {
        devLogger.error("Failed to fetch tasks", { date, error });
        set({
          error: "Task 목록을 불러오는데 실패했습니다.",
          isLoading: false,
        });
      }
    },

    addTask: async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        set({ error: "Task 내용을 입력해주세요." });
        return;
      }
      if (trimmedText.length > MAX_TASK_TEXT_LENGTH) {
        set({ error: "Task는 100자 이하로 입력해주세요." });
        return;
      }
      try {
        const response = await taskApi.createTask(trimmedText);
        const newTask = mapTaskResToTask(response);
        set((state) => ({ tasks: [...state.tasks, newTask], error: null }));
      } catch (error) {
        devLogger.error("Failed to create task", { error });
        set({ error: "Task 생성에 실패했습니다." });
      }
    },

    toggleTask: async (id: number) => {
      if (isPending(id)) return;
      const { tasks } = get();
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      set({ error: null });
      addPending(id);

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
      } catch (error) {
        devLogger.error("Failed to toggle task", { id, error });
        // 롤백
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, completed: task.completed } : t,
          ),
          error: "Task 상태 변경에 실패했습니다.",
        }));
      } finally {
        removePending(id);
      }
    },

    deleteTask: async (id: number) => {
      if (isPending(id)) return;
      const { tasks } = get();
      const taskIndex = tasks.findIndex((t) => t.id === id);
      const taskToDelete = taskIndex >= 0 ? tasks[taskIndex] : undefined;
      if (!taskToDelete) return;

      set({ error: null });
      addPending(id);

      // 낙관적 업데이트
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));

      try {
        await taskApi.deleteTask(id);
      } catch (error) {
        devLogger.error("Failed to delete task", { id, error });
        // 롤백
        set((state) => ({
          tasks: [
            ...state.tasks.slice(0, taskIndex),
            taskToDelete,
            ...state.tasks.slice(taskIndex),
          ],
          error: "Task 삭제에 실패했습니다.",
        }));
      } finally {
        removePending(id);
      }
    },

    editTask: async (id: number, newText: string) => {
      const trimmedText = newText.trim();
      if (!trimmedText) {
        set({ error: "Task 내용을 입력해주세요." });
        return;
      }
      if (trimmedText.length > MAX_TASK_TEXT_LENGTH) {
        set({ error: "Task는 100자 이하로 입력해주세요." });
        return;
      }
      if (isPending(id)) return;
      const { tasks } = get();
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      set({ error: null });
      addPending(id);

      const oldText = task.text;

      // 낙관적 업데이트
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, text: trimmedText } : t,
        ),
      }));

      try {
        await taskApi.updateTask(id, trimmedText);
      } catch (error) {
        devLogger.error("Failed to update task", { id, error });
        // 롤백
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, text: oldText } : t,
          ),
          error: "Task 수정에 실패했습니다.",
        }));
      } finally {
        removePending(id);
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
  };
});
