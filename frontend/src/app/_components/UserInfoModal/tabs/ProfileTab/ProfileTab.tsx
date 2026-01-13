import { useState } from "react";
import { CalendarHeatmap } from "./components/CalendarHeatmap/CalendarHeatmap";
import StatsSection from "./components/StatsSection/StatsSection";
import TaskSection from "./components/TaskSection/TaskSection";
import { generateMockTasks } from "./lib/mockDataGenerator";

const mockTasks = generateMockTasks(30);

export default function ProfileTab() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="space-y-4">
      <CalendarHeatmap
        tasks={mockTasks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="space-y-4 text-amber-900">
        <StatsSection />
        <TaskSection selectedDate={selectedDate} />
      </div>
    </div>
  );
}
