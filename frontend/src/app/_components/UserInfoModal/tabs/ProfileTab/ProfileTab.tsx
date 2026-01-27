import { useState } from "react";
import { CalendarHeatmap } from "./components/CalendarHeatmap/CalendarHeatmap";
import StatsSection from "./components/StatsSection/StatsSection";
import TaskSection from "./components/TaskSection/TaskSection";
import { Loading } from "@/_components/ui/loading";
import { useProfileData } from "./hooks/useProfileData";
import { useModalStore } from "@/stores/useModalStore";

export default function ProfileTab() {
  const targetPlayerId = useModalStore(
    (state) => state.userInfoPayload?.playerId,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { dailyTaskCounts, focusTimeData, githubEvents, tasks, isLoading } =
    useProfileData(targetPlayerId ?? 0, selectedDate);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loading size="lg" text="프로필 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarHeatmap
        dailyTaskCounts={dailyTaskCounts}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="space-y-4 text-amber-900">
        <StatsSection
          tasks={tasks}
          selectedDate={selectedDate}
          focusTimeSeconds={focusTimeData?.totalFocusSeconds}
          githubEvents={githubEvents}
        />
        <TaskSection tasks={tasks} selectedDate={selectedDate} />
      </div>
    </div>
  );
}
