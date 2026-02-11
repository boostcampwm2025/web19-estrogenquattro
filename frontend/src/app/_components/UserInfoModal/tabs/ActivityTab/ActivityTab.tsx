import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarHeatmap } from "./components/CalendarHeatmap/CalendarHeatmap";
import StatsSection from "./components/StatsSection/StatsSection";
import DetailSection from "./components/DetailSection/DetailSection";
import { Loading } from "@/_components/ui/loading";
import { useActivityData } from "./hooks/useActivityData";
import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";
import { STAT_CARD_TYPES, StatCardType } from "./constants/constants";

export default function ActivityTab() {
  const { t } = useTranslation("ui");
  const targetPlayerId = useModalStore(
    (state) => state.userInfoPayload?.playerId,
  );
  const { user } = useAuthStore();
  const playerId = targetPlayerId ?? user?.playerId ?? 0;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCard, setSelectedCard] = useState<StatCardType>(
    STAT_CARD_TYPES.TASK,
  );
  const { dailyPoints, focusTimeData, githubEvents, tasks, isLoading } =
    useActivityData(playerId, selectedDate);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loading size="lg" text={t(($) => $.userInfoModal.loading)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarHeatmap
        dailyPoints={dailyPoints}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="space-y-4 text-amber-900">
        <StatsSection
          tasks={tasks}
          selectedDate={selectedDate}
          focusTimeSeconds={focusTimeData?.totalFocusSeconds}
          githubEvents={githubEvents}
          dailyPoints={dailyPoints}
          playerId={playerId}
          selectedCard={selectedCard}
          onCardSelect={setSelectedCard}
        />
        <DetailSection
          selectedCard={selectedCard}
          tasks={tasks}
          selectedDate={selectedDate}
          playerId={playerId}
        />
      </div>
    </div>
  );
}
