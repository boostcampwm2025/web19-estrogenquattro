interface TaskSectionProps {
  selectedDate: Date;
}

export default function TaskSection({ selectedDate }: TaskSectionProps) {
  // Mock task data - 선택된 날짜에 따라 변경될 수 있음
  const tasks = [
    { id: 1, title: "API 엔드포인트 작성", completed: true, time: "02:15" },
    { id: 2, title: "컴포넌트 스타일 가이드", completed: true, time: "01:30" },
    { id: 3, title: "유저 인증 로직 구현", completed: false, time: "00:45" },
  ];

  const formatSelectedDate = () => {
    return selectedDate.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  return (
    <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Task 목록</p>
        <p className="text-xs text-amber-700">{formatSelectedDate()}</p>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
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
                {task.title}
              </span>
            </div>
            <span className="text-xs text-amber-700">{task.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
