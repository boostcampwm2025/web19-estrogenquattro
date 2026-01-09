import { Play, Edit2, Trash2, Pause, Check, X } from "lucide-react";
import { Task } from "./types";
import { Checkbox } from "@/_components/ui/checkbox";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { useState } from "react";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleTimer: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  formatTime: (seconds: number) => string;
}

export function TaskItem({
  task,
  onToggle,
  onDelete,
  onToggleTimer,
  onEdit,
  formatTime,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  const handleEditClick = () => {
    setIsEditing(true);
    setEditText(task.text);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editText.trim()) {
      onEdit(task.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditText(task.text);
    setIsEditing(false);
  };

  return (
    <div className="group border-retro-border-dark bg-retro-bg-secondary shadow-retro-sm hover:border-retro-border-darker flex items-center gap-3 rounded-none border-2 px-3 py-3 transition-colors">
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id)}
        className="data-[state=checked]:border-retro-border-darker data-[state=checked]:bg-retro-button-bg border-retro-border-dark h-5 w-5 rounded-none border-2"
      />

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex gap-2">
            <Input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="border-retro-border-dark text-retro-text-primary h-8 flex-1 rounded-none border-2 bg-white px-2 text-sm"
              autoFocus
            />
            <Button
              type="submit"
              className="border-retro-border-darker bg-retro-button-bg text-retro-button-text hover:bg-retro-button-hover flex h-8 w-8 items-center justify-center rounded-none border-2"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              className="border-retro-border-darker bg-retro-border-light text-retro-button-text hover:bg-retro-button-bg flex h-8 w-8 items-center justify-center rounded-none border-2"
              onClick={handleEditCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <>
            <div
              className={`text-sm ${task.completed ? "text-retro-text-tertiary line-through" : "text-retro-text-primary"}`}
            >
              {task.text}
            </div>
            <div className="text-retro-text-secondary mt-0.5 text-xs">
              {formatTime(task.time)}
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-1">
          <Button
            className={`flex h-8 w-8 items-center justify-center rounded-none border-2 transition-all ${
              task.isRunning
                ? "border-retro-border-darker bg-retro-button-bg text-retro-button-text hover:bg-retro-button-hover"
                : "border-retro-border-dark text-retro-text-secondary hover:bg-retro-hover-bg hover:text-retro-border-darker bg-transparent"
            }`}
            onClick={() => onToggleTimer(task.id)}
          >
            {task.isRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            className="border-retro-border-light text-retro-text-secondary hover:bg-retro-hover-bg hover:text-retro-border-darker flex h-8 w-8 items-center justify-center rounded-none border-2 bg-transparent transition-all"
            onClick={handleEditClick}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            className="border-retro-border-light text-retro-text-secondary hover:bg-retro-hover-darker hover:text-retro-delete-hover flex h-8 w-8 items-center justify-center rounded-none border-2 bg-transparent transition-all"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
