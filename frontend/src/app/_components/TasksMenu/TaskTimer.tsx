import { Play, Pause } from "lucide-react";
import { Button } from "@/_components/ui/button";
import { InlineAlert } from "@/_components/ui/inline-alert";

interface TaskTimerProps {
  time: string;
  isRunning: boolean;
  onToggle: () => void;
  error?: string | null;
}

export function TaskTimer({
  time,
  isRunning,
  onToggle,
  error,
}: TaskTimerProps) {
  return (
    <div className="mb-6">
      <div className="text-md mb-3 text-amber-900">[ Focus Time ]</div>
      <InlineAlert message={error} />
      <div className="mb-4 rounded-none border-3 border-amber-900 bg-white/50 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
        <div className="text-center text-3xl text-amber-900">{time}</div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={onToggle}
          className="border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-lg hover:bg-retro-button-hover flex flex-1 items-center justify-center gap-2 rounded-none border-2 py-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" />
              정지
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              시작
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
