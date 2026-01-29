import { Task } from "@/app/_components/TasksMenu/types";
import { STAT_CARD_TYPES, StatCardType } from "../../constants/constants";
import TaskSection from "../TaskSection/TaskSection";
import GitEventDetail from "./GitEventDetail";

interface DetailSectionProps {
  selectedCard: StatCardType;
  tasks: Task[];
  selectedDate: Date;
  playerId: number;
}

export default function DetailSection({
  selectedCard,
  tasks,
  selectedDate,
  playerId,
}: DetailSectionProps) {
  if (selectedCard === STAT_CARD_TYPES.TASK) {
    return <TaskSection tasks={tasks} selectedDate={selectedDate} />;
  }

  return (
    <GitEventDetail
      selectedCard={selectedCard}
      selectedDate={selectedDate}
      playerId={playerId}
    />
  );
}