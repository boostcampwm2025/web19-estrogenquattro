import { Play, Pause } from "lucide-react";
import { Button } from "@/_components/ui/button";
import { InlineAlert } from "@/_components/ui/inline-alert";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("ui");
  return (
    <div className="mb-6">
      <InlineAlert message={error} />
      <div className="mb-4 rounded-none border-3 border-amber-900 bg-white/50 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
        <div className="text-center text-3xl text-amber-900">{time}</div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={onToggle}
          className="text-md border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-lg hover:bg-retro-button-hover flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-none border-2 py-1 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" />
              {t(($) => $.focusPanel.timer.stop)}
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {t(($) => $.focusPanel.timer.start)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
