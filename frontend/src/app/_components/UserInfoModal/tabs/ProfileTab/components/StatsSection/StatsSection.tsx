import { Task } from "@/app/_components/TasksMenu/types";
import GrassCard from "./GrassCard";
import StatCard from "./StatCard";
import { calculateDailyStats } from "../../lib/dateStats";
import { isSameDay } from "../../lib/dateUtils";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";

interface StatsSectionProps {
  tasks: Task[];
  selectedDate: Date;
}

export default function StatsSection({
  tasks,
  selectedDate,
}: StatsSectionProps) {
  const focusTime = useFocusTimeStore((state) => state.focusTime);

  // 오늘 날짜인지 확인
  const isToday = isSameDay(selectedDate, new Date());

  // TODO: [API 연동] 과거 날짜의 focusTime도 서버에서 가져와야 함
  // 현재: 오늘이면 실제 focusTime, 과거면 undefined (Task 시간 합산)
  // 변경 후: 모든 날짜의 focusTime을 서버에서 조회
  const stats = calculateDailyStats(
    tasks,
    selectedDate,
    isToday ? focusTime : undefined,
  );

  return (
    <div className="flex h-60 gap-4">
      <GrassCard />
      <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-2">
        <StatCard title="집중시간" value={stats.focusTime} />
        <StatCard title="TASK" value={stats.completedTasks} />
        <StatCard title="PUSH" value={stats.push} />
        <StatCard title="ISSUE" value={stats.issue} />
        <StatCard title="PR 생성" value={stats.prCreated} />
        <StatCard title="PR 리뷰" value={stats.prReview} />
      </div>
    </div>
  );
}
