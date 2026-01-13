import { useState, useMemo } from "react";
import { CalendarHeatmap } from "./components/CalendarHeatmap/CalendarHeatmap";
import StatsSection from "./components/StatsSection/StatsSection";
import TaskSection from "./components/TaskSection/TaskSection";
import { generateMockTasks } from "./lib/mockDataGenerator";
import { useTasksStore } from "@/stores/useTasksStore";
import { useShallow } from "zustand/react/shallow";
import { Task } from "@/app/_components/TasksMenu/types";

// TODO: [API 연동] 오늘 날짜를 제외한 과거 365일 Mock 데이터 (한 번만 생성)
// 실제 API 연동 시: 서버에서 과거 Task 데이터를 가져와서 사용
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayTime = today.getTime();

const mockTasks = generateMockTasks(365).filter((task) => {
  if (!task.date) return true;
  const taskDate = new Date(task.date);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate.getTime() !== todayTime;
});

export default function ProfileTab() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const realTasks = useTasksStore(useShallow((state) => state.tasks));

  // TODO: [API 연동] 오늘 날짜는 실제 tasks 사용, 과거는 mock 사용
  // 실제 API 연동 시: 서버에서 전체 기간의 Task 데이터를 가져와서 사용 (mockTasks 제거)
  const allTasks = useMemo(() => {
    // realTasks가 없으면 mockTasks 그대로 반환 (새 배열 생성 방지)
    if (realTasks.length === 0) return mockTasks;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 실제 tasks는 오늘 날짜로 설정
    const realTasksWithDate: Task[] = realTasks.map((task) => ({
      ...task,
      date: task.date || today,
    }));

    return [...realTasksWithDate, ...mockTasks];
  }, [realTasks]);

  return (
    <div className="space-y-4">
      <CalendarHeatmap
        tasks={allTasks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="space-y-4 text-amber-900">
        <StatsSection tasks={allTasks} selectedDate={selectedDate} />
        <TaskSection tasks={allTasks} selectedDate={selectedDate} />
      </div>
    </div>
  );
}
