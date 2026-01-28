import { Task } from "@/app/_components/TasksMenu/types";
import { GithubEventsRes } from "@/lib/api";
import GrassCard from "./GrassCard";
import StatCard from "./StatCard";
import { formatTimeFromSeconds } from "../../lib/dateStats";
import { isSameDay } from "../../lib/dateUtils";
import { DailyPoints } from "../CalendarHeatmap/useHeatmapData";

interface StatsSectionProps {
  tasks: Task[];
  selectedDate: Date;
  focusTimeSeconds?: number;
  githubEvents: GithubEventsRes | undefined;
  dailyPoints: DailyPoints;
}

export default function StatsSection({
  tasks,
  selectedDate,
  focusTimeSeconds,
  githubEvents,
  dailyPoints,
}: StatsSectionProps) {
  const focusTimeStr = formatTimeFromSeconds(focusTimeSeconds ?? 0);
  const isToday = isSameDay(selectedDate, new Date());
  const taskCount = isToday
    ? tasks.length
    : tasks.filter((t) => t.completed).length;

  return (
    <div className="flex h-60 gap-4">
      <GrassCard dailyPoints={dailyPoints} selectedDate={selectedDate} />
      <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-2">
        <StatCard title="집중시간" value={focusTimeStr} />
        <StatCard title="TASK" value={String(taskCount)} />
        <StatCard title="Commit" value={String(githubEvents?.committed ?? 0)} />
        <StatCard
          title="ISSUE"
          value={String(githubEvents?.issueOpened ?? 0)}
        />
        <StatCard
          title="PR 생성"
          value={String(githubEvents?.prCreated ?? 0)}
        />
        <StatCard
          title="PR 리뷰"
          value={String(githubEvents?.prReviewed ?? 0)}
        />
      </div>
    </div>
  );
}
