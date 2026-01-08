import { useState, useCallback } from "react";
import { Task } from "../types";

export const useTasks = (initialTasks: Task[] = []) => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const addTask = (text: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      completed: false,
      time: 0,
      isRunning: false,
    };
    setTasks([...tasks, newTask]);
  };

  const toggleTask = (id: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const editTask = (id: string, newText: string) => {
    setTasks(
      tasks.map((task) => (task.id === id ? { ...task, text: newText } : task)),
    );
  };

  const toggleTaskTimer = (id: string) => {
    setTasks(
      tasks.map(
        (task) =>
          task.id === id
            ? { ...task, isRunning: !task.isRunning }
            : { ...task, isRunning: false }, // 다른 작업은 정지
      ),
    );
  };

  const stopAllTasks = () => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => ({ ...task, isRunning: false })),
    );
  };

  const incrementTaskTime = useCallback((id: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id ? { ...task, time: task.time + 1 } : task,
      ),
    );
  }, []);

  const completedCount = tasks.filter((task) => task.completed).length;
  const runningTask = tasks.find((task) => task.isRunning);

  return {
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    editTask,
    toggleTaskTimer,
    stopAllTasks,
    incrementTaskTime,
    completedCount,
    runningTask,
  };
};
