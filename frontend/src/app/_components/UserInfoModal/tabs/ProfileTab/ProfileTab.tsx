import { useState } from "react";
import { CalendarHeatmap } from "./components/CalendarHeatmap/CalendarHeatmap";
import StatsSection from "./components/StatsSection/StatsSection";
import TaskSection from "./components/TaskSection/TaskSection";
import {
  generateMockTasks,
  generateMockDailyTaskCounts,
} from "./lib/mockDataGenerator";

// TODO: [API 연동] 히트맵용 일별 Task 개수 Mock 데이터
// 실제 API 연동 시: GET /api/tasks/daily-counts?userId={userId} 로 가져옴
const mockDailyTaskCounts = generateMockDailyTaskCounts(365);

// TODO: [API 연동] 선택한 날짜의 Task 목록 Mock 데이터
// 실제 API 연동 시: GET /api/tasks?userId={userId}&date={YYYY-MM-DD} 로 가져옴
const mockTasks = generateMockTasks(365);

export default function ProfileTab() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // TODO: [API 연동] 선택한 날짜의 Task 목록을 가져오는 함수
  // 실제 API 연동 시: selectedDate가 변경될 때 해당 날짜의 Task를 API로 요청
  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return mockTasks.filter((task) => task.createdDate === dateStr);
  };

  const selectedDateTasks = getTasksForDate(selectedDate);

  return (
    <div className="space-y-4">
      <CalendarHeatmap
        dailyTaskCounts={mockDailyTaskCounts}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="space-y-4 text-amber-900">
        <StatsSection tasks={selectedDateTasks} selectedDate={selectedDate} />
        <TaskSection tasks={selectedDateTasks} selectedDate={selectedDate} />
      </div>
    </div>
  );
}
