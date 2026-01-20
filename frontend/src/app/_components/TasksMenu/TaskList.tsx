import { useState, useRef, useEffect } from "react";
import { Plus, Check, X } from "lucide-react";
import { Task } from "./types";
import { TaskItem } from "./TaskItem";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { InlineAlert } from "@/_components/ui/inline-alert";

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
}: TaskListProps) {
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
        <h2 className="text-md text-retro-text-primary">[ Tasks ]</h2>
        <div className="flex items-center gap-2">
          <span className="text-retro-text-primary text-sm">
            {completedCount}/{totalCount}
          </span>
          <Button
            onClick={handleAddClick}
            className="border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-md hover:bg-retro-button-hover flex h-7 w-7 items-center justify-center rounded-none border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
              placeholder="새 작업..."
              className="border-retro-border-dark text-retro-text-primary placeholder:text-retro-text-tertiary flex-1 rounded-none border-2 bg-white px-3 py-2"
              autoFocus
            />
            <Button
              type="submit"
              className="border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-md hover:bg-retro-button-hover flex h-8 w-8 items-center justify-center rounded-none border-2 active:shadow-none"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              className="border-retro-border-darker bg-retro-border-light text-retro-button-text shadow-retro-md hover:bg-retro-button-bg flex h-8 w-8 items-center justify-center rounded-none border-2 active:shadow-none"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      <div
        ref={listRef}
        className="retro-scrollbar max-h-72 space-y-2 overflow-y-auto pr-2"
      >
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
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
