import { useState, useRef, useEffect } from "react";
import { Plus, Check, X } from "lucide-react";
import { Task } from "./types";
import { TaskItem } from "./TaskItem";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { InlineAlert } from "@/_components/ui/inline-alert";
import { useTranslation } from "react-i18next";

interface TaskListProps {
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  error?: string | null;
  pendingTaskIds: number[];
  onAddTask: (text: string) => void;
  onToggleTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onToggleTaskTimer: (id: number) => void;
  onEditTask: (id: number, newText: string) => void;
  formatTaskTime: (seconds: number) => string;
  getTaskDisplayTime: (task: Task) => number;
}

export function TaskList({
  tasks,
  completedCount,
  totalCount,
  error,
  pendingTaskIds,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onToggleTaskTimer,
  onEditTask,
  formatTaskTime,
  getTaskDisplayTime,
}: TaskListProps) {
  const { t } = useTranslation("ui");
  const [newTaskText, setNewTaskText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [tasks.length]);

  const handleAddClick = () => {
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      onAddTask(newTaskText.trim());
      setNewTaskText("");
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setNewTaskText("");
    setIsAdding(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-md text-amber-900">[ Tasks ]</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-amber-900">
            {completedCount}/{totalCount}
          </span>
          <Button
            onClick={handleAddClick}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-none border-2 border-amber-800 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] transition-all hover:bg-amber-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <InlineAlert message={error} />

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-3">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t(($) => $.focusPanel.tasks.newTaskPlaceholder)}
              className="flex-1 rounded-none border-2 border-amber-900 bg-white px-3 py-1 text-sm text-amber-900 placeholder:text-amber-500"
              autoFocus
            />
            <Button
              type="submit"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border-2 border-amber-800 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] transition-all hover:bg-amber-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              className="border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-lg hover:bg-retro-button-hover flex h-7 w-7 items-center justify-center rounded-none border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      <div
        ref={listRef}
        className="retro-scrollbar max-h-72 space-y-2 overflow-y-auto"
      >
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            displayTime={getTaskDisplayTime(task)}
            isPending={pendingTaskIds.includes(task.id)}
            onToggle={onToggleTask}
            onDelete={onDeleteTask}
            onToggleTimer={onToggleTaskTimer}
            onEdit={onEditTask}
            formatTime={formatTaskTime}
          />
        ))}
      </div>
    </div>
  );
}
