import { Task } from "@/app/_components/TasksMenu/types";
import { GithubEventsRes } from "@/lib/api";
import GrassCard from "./GrassCard";
import StatCard from "./StatCard";
import { formatTimeFromSeconds } from "../../lib/dateStats";

interface StatsSectionProps {
  tasks: Task[];
  selectedDate: Date;
  focusTimeMinutes?: number;
  githubEvents: GithubEventsRes | null;
}

export default function StatsSection({
  tasks,
  focusTimeMinutes,
  githubEvents,
}: StatsSectionProps) {
  const focusTimeStr = formatTimeFromSeconds((focusTimeMinutes ?? 0) * 60);
  const completedTasks = tasks.filter((t) => t.completed).length;

  return (
    <div className="flex h-60 gap-4">
      <GrassCard />
      <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-2">
        <StatCard title="집중시간" value={focusTimeStr} />
        <StatCard title="TASK" value={String(completedTasks)} />
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
