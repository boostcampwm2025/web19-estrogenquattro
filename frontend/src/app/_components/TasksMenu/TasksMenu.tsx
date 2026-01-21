"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Play, Pause } from "lucide-react";
import { TaskTimer } from "./TaskTimer";
import { TaskList } from "./TaskList";
import { formatTime, formatTaskTime } from "./utils/timeFormat";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
import { useTasksStore } from "@/stores/useTasksStore";
import { useShallow } from "zustand/react/shallow";

export default function App() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastRunTaskId, setLastRunTaskId] = useState<number | null>(null);

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

  // 마지막 Task 추적용
  const lastTask = useMemo(() => {
    return runningTask || tasks.find((task) => task.id === lastRunTaskId);
  }, [runningTask, tasks, lastRunTaskId]);

  const {
    focusTime,
    incrementFocusTime,
    isFocusTimerRunning,
    startFocusing,
    stopFocusing,
    focusError,
    clearFocusError,
  } = useFocusTimeStore(
    useShallow((state) => ({
      focusTime: state.focusTime,
      incrementFocusTime: state.incrementFocusTime,
      isFocusTimerRunning: state.isFocusTimerRunning,
      startFocusing: state.startFocusing,
      stopFocusing: state.stopFocusing,
      focusError: state.error,
      clearFocusError: state.clearError,
    })),
  );
  const isTimerRunning = isFocusTimerRunning || !!runningTask;

  // Focus Time 타이머 (Focus Time이나 Task 중 하나라도 실행 중이면 증가)
  useEffect(() => {
    let interval: number | undefined;
    if (isTimerRunning) {
      interval = window.setInterval(() => {
        incrementFocusTime();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, incrementFocusTime]);

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
      // 펼친 상태에서 전체 타이머 시작 시 마지막 Task 정보 초기화
      if (isExpanded) {
        setLastRunTaskId(null);
      }
    }
  };

  const handleToggleTaskTimer = (id: number) => {
    const targetTask = tasks.find((task) => task.id === id);

    if (targetTask && targetTask.isRunning) {
      // 같은 Task를 다시 클릭: 종료 + 서버에 resting 이벤트 전송
      stopFocusing();
    } else {
      // Task 시작 또는 전환 + 서버에 focusing 이벤트 전송 (taskName, taskId 포함)
      startFocusing(targetTask?.description, targetTask?.id);
      // 마지막으로 실행한 Task ID 저장
      setLastRunTaskId(id);
      // 완료된 Task 타이머 시작 시 체크 해제
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

    // 실행 중인 Task를 체크하면 타이머 정지
    if (targetTask?.isRunning) {
      stopFocusing();
      toggleTaskTimer(id);
    }

    toggleTask(id);
  };

  return (
    <div className="w-md">
      <div className="border-3 border-amber-900 bg-[#ffecb3] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
        <div
          className={`flex cursor-pointer items-center justify-between transition-all duration-300 select-none ${
            isExpanded ? "mb-6" : "mb-0"
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h1 className="text-lg text-amber-900">► TASKS</h1>
          <button className="cursor-pointer text-amber-900 transition-colors hover:text-amber-700">
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
            onToggleTask={handleToggleTask}
            onDeleteTask={deleteTask}
            onToggleTaskTimer={handleToggleTaskTimer}
            onEditTask={editTask}
            formatTaskTime={formatTaskTime}
            error={error}
            pendingTaskIds={pendingTaskIds}
          />
        </div>

        {/* 접혔을 때 미니 컨트롤 */}
        {!isExpanded && (
          <div className="mt-4 flex items-center gap-3 border-t border-amber-900/20 pt-4">
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
        )}
      </div>
    </div>
  );
}
