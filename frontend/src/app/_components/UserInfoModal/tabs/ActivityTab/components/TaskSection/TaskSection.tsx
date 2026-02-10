import { Task } from "@/app/_components/TasksMenu/types";
import { useTranslation } from "react-i18next";
import { getTasksByDate, formatTimeFromSeconds } from "../../lib/dateStats";
import { isSameDay } from "../../lib/dateUtils";
import { formatSelectedDate } from "@/utils/timeFormat";

interface TaskSectionProps {
  tasks: Task[];
  selectedDate: Date;
}

export default function TaskSection({ tasks, selectedDate }: TaskSectionProps) {
  const { t } = useTranslation("ui");
  const isToday = isSameDay(selectedDate, new Date());
  const dailyTasks = getTasksByDate(tasks, selectedDate).filter(
    (task) => isToday || task.completed,
  );

  return (
    <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">
          {t("userInfoModal.activity.taskSection.title")}
        </p>
        <p className="text-xs text-amber-700">
          {formatSelectedDate(selectedDate)}
        </p>
      </div>

      <div className="space-y-2">
        {dailyTasks.length === 0 ? (
          <div className="py-4 text-center text-xs text-amber-700">
            {t("userInfoModal.activity.taskSection.empty")}
          </div>
        ) : (
          dailyTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-none border border-amber-200 bg-amber-100/50 p-2 transition-colors hover:border-amber-400"
            >
              <div className="flex flex-1 items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-none border-2 ${
                    task.completed
                      ? "border-amber-700 bg-amber-600"
                      : "border-amber-400 bg-transparent"
                  }`}
                ></div>
                <span
                  className={`text-xs ${task.completed ? "text-amber-600 line-through" : "text-amber-900"}`}
                >
                  {task.description}
                </span>
              </div>
              <span className="text-xs text-amber-700">
                {formatTimeFromSeconds(task.time)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
