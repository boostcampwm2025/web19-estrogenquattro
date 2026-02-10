import { Task } from "@/app/_components/TasksMenu/types";
import { GithubEventsRes } from "@/lib/api";
import { useTranslation } from "react-i18next";
import GrassCard from "./GrassCard";
import StatCard from "./StatCard";
import { formatTimeFromSeconds } from "../../lib/dateStats";
import { isSameDay } from "../../lib/dateUtils";
import { DailyPoints } from "../CalendarHeatmap/useHeatmapData";
import { StatCardType } from "../../constants/constants";
import { getStatCards } from "../../lib/statCards";

interface StatsSectionProps {
  tasks: Task[];
  selectedDate: Date;
  focusTimeSeconds?: number;
  githubEvents: GithubEventsRes | undefined;
  dailyPoints: DailyPoints;
  playerId: number;
  selectedCard: StatCardType;
  onCardSelect: (type: StatCardType) => void;
}

export default function StatsSection({
  tasks,
  selectedDate,
  focusTimeSeconds,
  githubEvents,
  dailyPoints,
  playerId,
  selectedCard,
  onCardSelect,
}: StatsSectionProps) {
  const { t } = useTranslation("ui");
  const focusTimeStr = formatTimeFromSeconds(focusTimeSeconds ?? 0);
  const isToday = isSameDay(selectedDate, new Date());
  const taskCount = isToday
    ? tasks.length
    : tasks.filter((t) => t.completed).length;

  const statCards = getStatCards(focusTimeStr, taskCount, githubEvents);

  return (
    <div className="flex h-60 gap-4">
      <GrassCard
        dailyPoints={dailyPoints}
        selectedDate={selectedDate}
        playerId={playerId}
      />
      <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-2">
        {statCards.map((card, index) => {
          const cardType = card.type;
          return (
            <StatCard
              key={index}
              title={t(card.titleKey)}
              value={card.value}
              onClick={cardType ? () => onCardSelect(cardType) : undefined}
              isSelected={cardType === selectedCard}
            />
          );
        })}
      </div>
    </div>
  );
}
