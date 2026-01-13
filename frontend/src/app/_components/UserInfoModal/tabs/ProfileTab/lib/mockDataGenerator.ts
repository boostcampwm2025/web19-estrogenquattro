import { Task } from "@/app/_components/TasksMenu/types";
import { getDateRange } from "./dateUtils";

const TASK_NAMES = [
  "API 엔드포인트 작성",
  "컴포넌트 리팩토링",
  "버그 수정",
  "유닛 테스트 작성",
  "문서 작성",
  "코드 리뷰",
  "디자인 개선",
  "성능 최적화",
  "데이터베이스 스키마 설계",
  "CI/CD 파이프라인 구축",
  "보안 취약점 분석",
  "기능 개발",
  "UI/UX 개선",
  "타입 정의 추가",
  "에러 핸들링 구현",
  "로깅 시스템 구축",
  "캐싱 전략 적용",
  "알고리즘 최적화",
  "프로토타입 제작",
  "회의 및 기획",
];

export function generateMockTasks(daysCount: number = 365): Task[] {
  const tasks: Task[] = [];
  const { startDate, endDate } = getDateRange(daysCount);

  let taskId = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // 날짜마다 0~25개의 Task 생성 (GitHub 히트맵 레벨과 매칭)
    const taskCount = Math.floor(Math.random() * 26);

    for (let i = 0; i < taskCount; i++) {
      const isCompleted = Math.random() > 0.3; // 70% 확률로 완료
      const timeInSeconds = isCompleted
        ? Math.floor(Math.random() * 7200) + 300 // 5분~2시간
        : Math.floor(Math.random() * 1800); // 0~30분 (미완료는 시간이 적음)

      tasks.push({
        id: `mock-${taskId++}`,
        text: TASK_NAMES[Math.floor(Math.random() * TASK_NAMES.length)],
        completed: isCompleted,
        time: timeInSeconds,
        date: new Date(d),
      });
    }
  }
  return tasks;
}
