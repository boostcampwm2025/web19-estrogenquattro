"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TaskTimer } from "./TaskTimer";
import { TaskList } from "./TaskList";
import { Task } from "./types";
import { useTasks } from "./hooks/useTasks";
import { formatTime, formatTaskTime } from "./utils/timeFormat";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    text: "API 엔드포인트 상성 문서",
    completed: false,
    time: 512,
    isRunning: false,
  },
  {
    id: "2",
    text: "컴포넌트북스 스타일 가이드",
    completed: false,
    time: 0,
    isRunning: false,
  },
  {
    id: "3",
    text: "유저 인증 로직 구현",
    completed: false,
    time: 0,
    isRunning: false,
  },
];

export default function App() {
  const [isExpanded, setIsExpanded] = useState(true);
  const {
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
  } = useTasks(INITIAL_TASKS);

  const { focusTime, incrementFocusTime } = useFocusTimeStore();
  const [isFocusTimerRunning, setIsFocusTimerRunning] = useState(false);
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
      // 정지: Focus Timer와 모든 Task 정지
      setIsFocusTimerRunning(false);
      stopAllTasks();
    } else {
      // 시작: Focus Timer만 시작
      setIsFocusTimerRunning(true);
    }
  };

  const handleToggleTaskTimer = (id: string) => {
    const targetTask = tasks.find((task) => task.id === id);

    // Task 종료시 Focus Timer도 종료
    if (targetTask && targetTask.isRunning) {
      setIsFocusTimerRunning(false);
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
          />
        </div>
      </div>
    </div>
  );
}
