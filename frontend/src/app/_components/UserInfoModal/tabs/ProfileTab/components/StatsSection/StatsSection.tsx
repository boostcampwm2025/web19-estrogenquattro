import { Task } from "@/app/_components/TasksMenu/types";
import GrassCard from "./GrassCard";
import StatCard from "./StatCard";
import { calculateDailyStats } from "../../lib/dateStats";

interface StatsSectionProps {
  tasks: Task[];
  selectedDate: Date;
  focusTimeMinutes?: number;
}

export default function StatsSection({
  tasks,
  selectedDate,
  focusTimeMinutes,
}: StatsSectionProps) {
  // API에서 받은 focusTimeMinutes(분)을 초로 변환하여 전달
  const focusTimeSeconds =
    focusTimeMinutes !== undefined ? focusTimeMinutes * 60 : undefined;

  const stats = calculateDailyStats(tasks, selectedDate, focusTimeSeconds);

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
