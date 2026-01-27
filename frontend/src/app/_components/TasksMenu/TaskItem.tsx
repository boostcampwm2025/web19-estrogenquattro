import { Play, Edit2, Trash2, Pause, Check, X, Loader2 } from "lucide-react";
import { Task } from "./types";
import { Checkbox } from "@/_components/ui/checkbox";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { useState } from "react";

interface TaskItemProps {
  task: Task;
  displayTime: number;
  isPending: boolean;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleTimer: (id: number) => void;
  onEdit: (id: number, newText: string) => void;
  formatTime: (seconds: number) => string;
}

export function TaskItem({
  task,
  displayTime,
  isPending,
  onToggle,
  onDelete,
  onToggleTimer,
  onEdit,
  formatTime,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.description);

  const handleEditClick = () => {
    setIsEditing(true);
    setEditText(task.description);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (editText.trim()) {
      onEdit(task.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditText(task.description);
    setIsEditing(false);
  };

  return (
    <div className="group flex items-center gap-3 rounded-none border-2 border-amber-900 bg-white/50 px-3 py-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-colors hover:border-amber-800">
      <Checkbox
        checked={task.completed}
        disabled={isPending}
        onCheckedChange={() => onToggle(task.id)}
        className="h-5 w-5 rounded-none border-2 border-amber-900 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-amber-900 data-[state=checked]:bg-amber-600"
      />

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <Input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleEditSubmit(e);
              if (e.key === "Escape") handleEditCancel();
            }}
            className="h-8 w-full rounded-none border-2 border-amber-900 bg-white px-2 text-sm text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
            disabled={isPending}
          />
        ) : (
          <>
            <div
              className={`text-sm ${task.completed ? "text-amber-500 line-through" : "text-amber-900"}`}
            >
              {task.description}
            </div>
            <div className="mt-0.5 text-xs text-amber-700">
              {formatTime(displayTime)}
            </div>
          </>
        )}
      </div>

      {isPending && <Loader2 className="h-4 w-4 animate-spin text-amber-700" />}

      {/* 버튼 영역 - 항상 우측에 고정 */}
      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <Button
              type="button"
              disabled={isPending}
              aria-label="작업 수정 저장"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border-2 border-amber-800 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] transition-all hover:bg-amber-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleEditSubmit}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              disabled={isPending}
              aria-label="작업 수정 취소"
              className="border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-lg hover:bg-retro-button-hover ml-1 flex h-7 w-7 items-center justify-center rounded-none border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleEditCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={isPending}
              aria-label={task.isRunning ? "타이머 일시정지" : "타이머 시작"}
              aria-pressed={task.isRunning}
              className={`flex h-8 w-8 items-center justify-center rounded-none border-2 transition-all ${
                task.isRunning
                  ? "border-amber-900 bg-amber-600 text-white hover:bg-amber-700"
                  : "border-amber-900/50 bg-transparent text-amber-700 hover:bg-amber-100 hover:text-amber-900"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => onToggleTimer(task.id)}
            >
              {task.isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              disabled={isPending}
              aria-label="작업 편집"
              className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-amber-900/50 bg-transparent text-amber-700 transition-all hover:bg-amber-100 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleEditClick}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              disabled={isPending}
              aria-label="작업 삭제"
              className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-amber-900/50 bg-transparent text-amber-700 transition-all hover:bg-amber-100 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
