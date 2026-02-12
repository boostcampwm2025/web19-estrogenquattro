import { create } from "zustand";
import i18next from "i18next";
import { Task } from "@/app/_components/TasksMenu/types";
import { taskApi, ApiError } from "@/lib/api";
import { devLogger } from "@/lib/devLogger";
import { FOCUS_STATUS, useFocusTimeStore } from "./useFocusTimeStore";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "./authStore";
import {
  getLocalDayRange,
  parseLocalDate,
  toDateString,
} from "@/utils/timeFormat";
import { getErrorMessage } from "@/lib/errors/messages";
import { mapTaskResToTask } from "@/app/_components/TasksMenu/utils/mappers";

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

  // 로컬 전용 액션 (타이머) - 타임스탬프 기반
  toggleTaskTimer: (id: number) => void;
  stopAllTasks: () => void;
  getTaskDisplayTime: (task: Task) => number;

  // 자정 리셋: 완료된 태스크 제거
  removeCompletedTasks: () => void;
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
      const { user, isLoading: isAuthLoading } = useAuthStore.getState();
      if (isAuthLoading) {
        return;
      }
      const playerId = user?.playerId;
      if (!playerId) {
        set({
          tasks: [],
          pendingTaskIds: [],
          error: i18next.t(($: { error: { loginRequired: string } }) => $.error.loginRequired, { ns: "common" }),
          isLoading: false,
        });
        return;
      }

      // date가 없으면 오늘 날짜로 기본 설정, 있으면 해당 날짜의 로컬 날짜 범위로 변환
      const dateObj = date ? parseLocalDate(date) : new Date();
      const { startAt, endAt } = getLocalDayRange(dateObj);
      const isToday = toDateString(dateObj) === toDateString(new Date());

      set({ isLoading: true, error: null });
      try {
        const response = await taskApi.getTasks(
          playerId,
          isToday,
          startAt,
          endAt,
        );
        const tasks = response.tasks.map(mapTaskResToTask);
        set({ tasks, isLoading: false });
      } catch (error) {
        devLogger.error("Failed to fetch tasks", { date, error });
        set({
          error: i18next.t(($: { error: { taskFetchFailed: string } }) => $.error.taskFetchFailed, { ns: "common" }),
          isLoading: false,
        });
      }
    },

    addTask: async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        set({ error: i18next.t(($: { error: { taskInputRequired: string } }) => $.error.taskInputRequired, { ns: "common" }) });
        return;
      }
      if (trimmedText.length > MAX_TASK_TEXT_LENGTH) {
        set({ error: i18next.t(($: { error: { taskTooLong: string } }) => $.error.taskTooLong, { ns: "common" }) });
        return;
      }
      try {
        const response = await taskApi.createTask(trimmedText);
        const newTask = mapTaskResToTask(response);
        set((state) => ({ tasks: [...state.tasks, newTask], error: null }));
      } catch (error) {
        devLogger.error("Failed to create task", { error });
        set({ error: i18next.t(($: { error: { taskCreateFailed: string } }) => $.error.taskCreateFailed, { ns: "common" }) });
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
          error: i18next.t(($: { error: { taskToggleFailed: string } }) => $.error.taskToggleFailed, { ns: "common" }),
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

      // 집중 중인 Task는 삭제 차단 (서버 요청 없이 즉시 에러)
      if (taskToDelete.isRunning) {
        set({ error: getErrorMessage("TASK_FOCUSING") });
        return;
      }

      // 낙관적 업데이트
      set({ error: null });
      addPending(id);
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));

      try {
        await taskApi.deleteTask(id);
      } catch (error) {
        devLogger.error("Failed to delete task", { id, error });
        const errorCode = error instanceof ApiError ? error.code : undefined;
        const errorMessage = getErrorMessage(
          errorCode,
          i18next.t(($: { error: { taskDeleteFailed: string } }) => $.error.taskDeleteFailed, { ns: "common" }),
        );
        // 롤백
        set((state) => ({
          tasks: [
            ...state.tasks.slice(0, taskIndex),
            taskToDelete,
            ...state.tasks.slice(taskIndex),
          ],
          error: errorMessage,
        }));
      } finally {
        removePending(id);
      }
    },

    editTask: async (id: number, newText: string) => {
      const trimmedText = newText.trim();
      if (!trimmedText) {
        set({ error: i18next.t(($: { error: { taskInputRequired: string } }) => $.error.taskInputRequired, { ns: "common" }) });
        return;
      }
      if (trimmedText.length > MAX_TASK_TEXT_LENGTH) {
        set({ error: i18next.t(($: { error: { taskTooLong: string } }) => $.error.taskTooLong, { ns: "common" }) });
        return;
      }
      if (isPending(id)) return;
      const { tasks } = get();
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      set({ error: null });
      addPending(id);

      const oldDescription = task.description;

      // 낙관적 업데이트
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, description: trimmedText } : t,
        ),
      }));

      try {
        await taskApi.updateTask(id, trimmedText);

        // 집중 중인 Task 이름 변경 시 다른 플레이어에게 브로드캐스트
        if (task.isRunning) {
          const { status } = useFocusTimeStore.getState();
          if (status === FOCUS_STATUS.FOCUSING) {
            const socket = getSocket();
            if (socket?.connected) {
              socket.emit("focus_task_updating", { taskName: trimmedText });
            }
          }
        }
      } catch (error) {
        devLogger.error("Failed to update task", { id, error });
        // 롤백
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, description: oldDescription } : t,
          ),
          error: i18next.t(($: { error: { taskEditFailed: string } }) => $.error.taskEditFailed, { ns: "common" }),
        }));
      } finally {
        removePending(id);
      }
    },

    // 타임스탬프 기반 태스크 시간 계산
    getTaskDisplayTime: (task: Task) => {
      if (task.isRunning && task.startTimestamp) {
        return (
          task.baseTime + Math.floor((Date.now() - task.startTimestamp) / 1000)
        );
      }
      return task.time;
    },

    // 타임스탬프 기반 타이머 토글
    toggleTaskTimer: (id: number) => {
      const { tasks } = get();
      const targetTask = tasks.find((t) => t.id === id);
      if (!targetTask) return;

      set((state) => ({
        tasks: state.tasks.map((task) => {
          if (task.id === id) {
            // 대상 태스크 토글
            if (task.isRunning) {
              // 정지: 경과 시간을 time에 반영
              const elapsed = task.startTimestamp
                ? Math.floor((Date.now() - task.startTimestamp) / 1000)
                : 0;
              const newTime = task.baseTime + elapsed;
              return {
                ...task,
                isRunning: false,
                time: newTime,
                baseTime: newTime,
                startTimestamp: null,
              };
            } else {
              // 시작: 타임스탬프 설정
              return {
                ...task,
                isRunning: true,
                baseTime: task.time,
                startTimestamp: Date.now(),
              };
            }
          }

          // 다른 실행 중인 태스크는 정지 (경과 시간 누적)
          if (task.isRunning && task.startTimestamp) {
            const elapsed = Math.floor(
              (Date.now() - task.startTimestamp) / 1000,
            );
            const newTime = task.baseTime + elapsed;
            return {
              ...task,
              isRunning: false,
              time: newTime,
              baseTime: newTime,
              startTimestamp: null,
            };
          }

          return task;
        }),
      }));
    },

    // 모든 태스크 정지 (경과 시간 누적)
    stopAllTasks: () =>
      set((state) => ({
        tasks: state.tasks.map((task) => {
          if (task.isRunning && task.startTimestamp) {
            const elapsed = Math.floor(
              (Date.now() - task.startTimestamp) / 1000,
            );
            const newTime = task.baseTime + elapsed;
            return {
              ...task,
              isRunning: false,
              time: newTime,
              baseTime: newTime,
              startTimestamp: null,
            };
          }
          return { ...task, isRunning: false };
        }),
      })),

    // 완료된 태스크 제거 (KST 자정 리셋용)
    removeCompletedTasks: () =>
      set((state) => ({
        tasks: state.tasks.filter((task) => !task.completed),
      })),
  };
});
