import { create } from "zustand";
import { Task } from "@/app/_components/TasksMenu/types";

interface TasksStore {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  editTask: (id: string, newText: string) => void;
  toggleTaskTimer: (id: string) => void;
  stopAllTasks: () => void;
  incrementTaskTime: (id: string) => void;
}

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    text: "API 엔드포인트 상성 문서",
    completed: false,
    time: 0,
    isRunning: false,
    date: new Date(),
  },
];

export const useTasksStore = create<TasksStore>((set) => ({
  tasks: INITIAL_TASKS,

  setTasks: (tasks) => set({ tasks }),

  addTask: (text) =>
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id: Date.now().toString(),
          text,
          completed: false,
          time: 0,
          isRunning: false,
          date: new Date(),
        },
      ],
    })),

  toggleTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    })),

  deleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    })),

  editTask: (id, newText) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, text: newText } : task,
      ),
    })),

  toggleTaskTimer: (id) =>
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

  incrementTaskTime: (id) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, time: task.time + 1 } : task,
      ),
    })),
}));
