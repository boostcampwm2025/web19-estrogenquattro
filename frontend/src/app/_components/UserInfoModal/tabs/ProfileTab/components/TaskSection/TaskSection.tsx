import { Task } from "@/app/_components/TasksMenu/types";
import { getTasksByDate, formatTimeFromSeconds } from "../../lib/dateStats";
import { isSameDay } from "../../lib/dateUtils";

interface TaskSectionProps {
  tasks: Task[];
  selectedDate: Date;
}

export default function TaskSection({ tasks, selectedDate }: TaskSectionProps) {
  const isToday = isSameDay(selectedDate, new Date());
  const dailyTasks = getTasksByDate(tasks, selectedDate).filter(
    (task) => isToday || task.completed,
  );

  const formatSelectedDate = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const day = selectedDate.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[selectedDate.getDay()];

    // 일자를 항상 2자리로 표시하여 너비 고정
    return `${year}년 ${month}월 ${String(day).padStart(2, "0")}일 ${weekday}`;
  };

  return (
    <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Task 목록</p>
        <p className="text-xs text-amber-700">{formatSelectedDate()}</p>
      </div>

      <div className="space-y-2">
        {dailyTasks.length === 0 ? (
          <div className="py-4 text-center text-xs text-amber-700">
            이 날짜에 등록된 Task가 없습니다.
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
