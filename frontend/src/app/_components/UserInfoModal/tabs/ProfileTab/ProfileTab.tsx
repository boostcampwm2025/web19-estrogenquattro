import { useState } from "react";
import { CalendarHeatmap } from "./components/CalendarHeatmap/CalendarHeatmap";
import StatsSection from "./components/StatsSection/StatsSection";
import TaskSection from "./components/TaskSection/TaskSection";
import { generateMockTasks } from "./lib/mockDataGenerator";
import { Loading } from "@/_components/ui/loading";
import { useProfileData } from "./hooks/useProfileData";
import { toDateString } from "@/utils/timeFormat";
import { useUserInfoStore } from "@/stores/userInfoStore";

// TODO: [API 연동] 선택한 날짜의 Task 목록 Mock 데이터
const mockTasks = generateMockTasks(365);

export default function ProfileTab() {
  const targetPlayerId = useUserInfoStore((state) => state.targetPlayerId);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { dailyTaskCounts, focusTimeData, isLoading } = useProfileData(
    targetPlayerId ?? 0,
    selectedDate,
  );

  // TODO: [API 연동] 선택한 날짜의 Task 목록을 가져오는 함수
  const getTasksForDate = (date: Date) => {
    const dateStr = toDateString(date);
    return mockTasks.filter((task) => task.createdDate === dateStr);
  };

  const selectedDateTasks = getTasksForDate(selectedDate);

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
          tasks={selectedDateTasks}
          selectedDate={selectedDate}
          focusTimeMinutes={focusTimeData?.totalFocusMinutes}
        />
        <TaskSection tasks={selectedDateTasks} selectedDate={selectedDate} />
      </div>
    </div>
  );
}
