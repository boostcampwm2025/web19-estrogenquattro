"use client";

import { useState, useEffect, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import { TaskTimer } from "./TaskTimer";
import { TaskList } from "./TaskList";
import { formatTime, formatTaskTime } from "./utils/timeFormat";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
import { useTasksStore } from "@/stores/useTasksStore";
import { useShallow } from "zustand/react/shallow";

interface TasksMenuContentProps {
  isExpanded: boolean;
  lastRunTaskId: number | null;
  setLastRunTaskId: (id: number | null) => void;
}

export default function TasksMenuContent({
  isExpanded,
  lastRunTaskId,
  setLastRunTaskId,
}: TasksMenuContentProps) {
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
    getTaskDisplayTime,
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
      getTaskDisplayTime: state.getTaskDisplayTime,
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

  // 마지막 Task 추적용
  const lastTask = useMemo(() => {
    return runningTask || tasks.find((task) => task.id === lastRunTaskId);
  }, [runningTask, tasks, lastRunTaskId]);

  const {
    getFocusTime,
    baseFocusSeconds,
    isFocusTimerRunning,
    startFocusing,
    stopFocusing,
    focusError,
    clearFocusError,
  } = useFocusTimeStore(
    useShallow((state) => ({
      getFocusTime: state.getFocusTime,
      baseFocusSeconds: state.baseFocusSeconds,
      isFocusTimerRunning: state.isFocusTimerRunning,
      startFocusing: state.startFocusing,
      stopFocusing: state.stopFocusing,
      focusError: state.error,
      clearFocusError: state.clearError,
    })),
  );
  const isTimerRunning = isFocusTimerRunning || !!runningTask;

  // UI 갱신용 tick (실제 시간 계산은 타임스탬프 기반)
  const [tick, setTick] = useState(0);

  // 타이머 실행 중일 때 1초마다 tick 증가 (UI 갱신 트리거)
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // 탭 복귀 시 즉시 재계산
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // 타임스탬프 기반 시간 계산 (tick 변경 시 재계산)
  const focusTime = useMemo(() => {
    return getFocusTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, isFocusTimerRunning, baseFocusSeconds, getFocusTime]);

  useEffect(() => {
    if (!focusError) return;
    const timeout = window.setTimeout(() => {
      clearFocusError();
    }, 3000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [focusError, clearFocusError]);

  const handleToggleTimer = () => {
    if (isTimerRunning) {
      stopFocusing();
      stopAllTasks();
    } else {
      startFocusing();
      setLastRunTaskId(null);
    }
  };

  const handleToggleTaskTimer = (id: number) => {
    const targetTask = tasks.find((task) => task.id === id);

    if (targetTask && targetTask.isRunning) {
      stopFocusing();
    } else {
      startFocusing(targetTask?.description, targetTask?.id);
      setLastRunTaskId(id);
      if (targetTask?.completed) {
        toggleTask(id);
      }
    }

    toggleTaskTimer(id);
  };

  const handleMiniControlClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lastTask) {
      handleToggleTaskTimer(lastTask.id);
    } else {
      handleToggleTimer();
    }
  };

  const handleToggleTask = (id: number) => {
    const targetTask = tasks.find((task) => task.id === id);
    if (targetTask?.isRunning) {
      stopFocusing();
      toggleTaskTimer(id);
    }
    toggleTask(id);
  };

  return (
    <>
      {/* 펼침 모드 */}
      <div className={isExpanded ? "block" : "hidden"}>
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
          onToggleTask={handleToggleTask}
          onDeleteTask={deleteTask}
          onToggleTaskTimer={handleToggleTaskTimer}
          onEditTask={editTask}
          formatTaskTime={formatTaskTime}
          getTaskDisplayTime={getTaskDisplayTime}
          error={error}
          pendingTaskIds={pendingTaskIds}
        />
      </div>

      {/* 미니 모드 */}
      <div className={!isExpanded ? "block" : "hidden"}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMiniControlClick}
            className="cursor-pointer text-amber-900 hover:text-amber-700"
            aria-label={isTimerRunning ? "정지" : "시작"}
          >
            {isTimerRunning ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>
          <div className="flex-1 truncate">
            {lastTask ? (
              <p className="truncate text-sm font-semibold text-amber-900">
                {lastTask.description}
              </p>
            ) : (
              <p className="text-sm text-amber-700">Task를 선택해주세요</p>
            )}
          </div>
          <span className="font-mono text-sm text-amber-900">
            {formatTime(focusTime)}
          </span>
        </div>
      </div>
    </>
  );
}
