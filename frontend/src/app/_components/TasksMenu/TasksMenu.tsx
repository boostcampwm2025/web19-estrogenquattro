"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TaskTimer } from "./TaskTimer";
import { TaskList } from "./TaskList";
import { formatTime, formatTaskTime } from "./utils/timeFormat";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
import { useTasksStore } from "@/stores/useTasksStore";
import { useShallow } from "zustand/react/shallow";

export default function App() {
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    tasks,
    isLoading,
    error,
    pendingTaskIds,
    fetchTasks,
    addTask,
    toggleTask,
    deleteTask,
    editTask,
    toggleTaskTimer,
    stopAllTasks,
    incrementTaskTime,
    clearTaskError,
  } = useTasksStore(
    useShallow((state) => ({
      tasks: state.tasks,
      isLoading: state.isLoading,
      error: state.error,
      pendingTaskIds: state.pendingTaskIds,
      fetchTasks: state.fetchTasks,
      addTask: state.addTask,
      toggleTask: state.toggleTask,
      deleteTask: state.deleteTask,
      editTask: state.editTask,
      toggleTaskTimer: state.toggleTaskTimer,
      stopAllTasks: state.stopAllTasks,
      incrementTaskTime: state.incrementTaskTime,
      clearTaskError: state.clearError,
    })),
  );

  // 마운트 시 Task 목록 조회
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => {
      clearTaskError();
    }, 3000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [error, clearTaskError]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks],
  );

  const runningTask = useMemo(
    () => tasks.find((task) => task.isRunning),
    [tasks],
  );

  const {
    focusTime,
    setFocusTime,
    isFocusTimerRunning,
    startFocusing,
    stopFocusing,
    focusError,
    clearFocusError,
  } = useFocusTimeStore(
    useShallow((state) => ({
      focusTime: state.focusTime,
      setFocusTime: state.setFocusTime,
      isFocusTimerRunning: state.isFocusTimerRunning,
      startFocusing: state.startFocusing,
      stopFocusing: state.stopFocusing,
      focusError: state.error,
      clearFocusError: state.clearError,
    })),
  );
  const isTimerRunning = isFocusTimerRunning || !!runningTask;

  // Focus Time 타이머 (경과 시간 기반 계산 - 탭 비활성화 시에도 정확)
  useEffect(() => {
    let interval: number | undefined;
    if (isTimerRunning) {
      interval = window.setInterval(() => {
        const { focusStartTimestamp, baseFocusSeconds } =
          useFocusTimeStore.getState();
        if (focusStartTimestamp) {
          const elapsed = Math.floor(
            (Date.now() - focusStartTimestamp) / 1000,
          );
          setFocusTime(baseFocusSeconds + elapsed);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, setFocusTime]);

  useEffect(() => {
    if (!focusError) return;
    const timeout = window.setTimeout(() => {
      clearFocusError();
    }, 3000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [focusError, clearFocusError]);

  // 개별 작업 타이머 (실행 중인 Task의 시간만 증가)
  useEffect(() => {
    let interval: number | undefined;

    if (runningTask) {
      interval = window.setInterval(() => {
        incrementTaskTime(runningTask.id);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runningTask, incrementTaskTime]);

  const handleToggleTimer = () => {
    if (isTimerRunning) {
      // 정지: Focus Timer와 모든 Task 정지 + 서버에 resting 이벤트 전송
      stopFocusing();
      stopAllTasks();
    } else {
      // 시작: Focus Timer 시작 + 서버에 focusing 이벤트 전송
      startFocusing();
    }
  };

  const handleToggleTaskTimer = (id: number) => {
    const targetTask = tasks.find((task) => task.id === id);

    if (targetTask && targetTask.isRunning) {
      // 같은 Task를 다시 클릭: 종료 + 서버에 resting 이벤트 전송
      stopFocusing();
    } else {
      // Task 시작 또는 전환 + 서버에 focusing 이벤트 전송 (taskName 포함)
      startFocusing(targetTask?.description);
    }

    toggleTaskTimer(id);
  };

  return (
    <div className="w-md">
      <div className="border-retro-border-dark bg-retro-bg-primary shadow-retro-xl rounded-none border-4 p-6">
        <div
          className={`flex cursor-pointer items-center justify-between transition-all duration-300 select-none ${
            isExpanded ? "mb-6" : "mb-0"
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h1 className="text-retro-text-primary text-lg">► TASKS</h1>
          <button className="text-retro-text-primary hover:text-retro-text-secondary cursor-pointer transition-colors">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>

        <div
          className={`transition-all duration-300 ease-in-out ${
            isExpanded
              ? "max-h-500 opacity-100"
              : "max-h-0 overflow-hidden opacity-0"
          }`}
        >
          <TaskTimer
            time={formatTime(focusTime)}
            isRunning={isTimerRunning}
            onToggle={handleToggleTimer}
            error={focusError}
          />

          <TaskList
            tasks={tasks}
            completedCount={completedCount}
            totalCount={tasks.length}
            onAddTask={addTask}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onToggleTaskTimer={handleToggleTaskTimer}
            onEditTask={editTask}
            formatTaskTime={formatTaskTime}
            error={error}
            pendingTaskIds={pendingTaskIds}
          />
        </div>
      </div>
    </div>
  );
}
