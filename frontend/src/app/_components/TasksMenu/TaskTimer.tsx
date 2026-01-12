import { Play, Pause } from "lucide-react";
import { Button } from "@/_components/ui/button";

interface TaskTimerProps {
  time: string;
  isRunning: boolean;
  onToggle: () => void;
}

export function TaskTimer({ time, isRunning, onToggle }: TaskTimerProps) {
  return (
    <div className="mb-6">
      <div className="text-md text-retro-text-primary mb-3">[ Focus Time ]</div>
      <div className="border-retro-border-dark bg-retro-bg-secondary shadow-retro-md mb-4 rounded-none border-3 p-6">
        <div className="text-retro-text-primary text-center text-3xl">
          {time}
        </div>
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
