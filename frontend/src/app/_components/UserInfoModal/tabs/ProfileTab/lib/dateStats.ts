import { Task } from "@/app/_components/TasksMenu/types";
import { isSameDay } from "./dateUtils";

export interface DailyStats {
  focusTime: string;
  completedTasks: string;
  push: string;
  issue: string;
  prCreated: string;
  prReview: string;
}

/**
 * 특정 날짜의 Task들을 필터링
 */
export function getTasksByDate(tasks: Task[], date: Date): Task[] {
  return tasks.filter((task) => task.date && isSameDay(task.date, date));
}

/**
 * 시간(초)을 HH:MM:SS 형식으로 변환
 */
export function formatTimeFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * 특정 날짜의 통계 계산
 * @param tasks - 전체 Task 목록
 * @param date - 조회할 날짜
 * @param realFocusTime - 실제 Focus Time (오늘 날짜인 경우)
 */
export function calculateDailyStats(
  tasks: Task[],
  date: Date,
  realFocusTime?: number,
): DailyStats {
  const dailyTasks = getTasksByDate(tasks, date);

  // 집중시간 계산
  let totalFocusTime: number;
  if (realFocusTime !== undefined) {
    // 오늘 날짜: 실제 Focus Time 사용
    totalFocusTime = realFocusTime;
  } else {
    // 과거 날짜: Task 시간 합산 (완료 여부 무관)
    totalFocusTime = dailyTasks.reduce(
      (sum, task) => sum + (task.time || 0),
      0,
    );
  }

  // 완료된 Task 개수 계산
  const completedCount = dailyTasks.filter((task) => task.completed).length;

  // TODO: [API 연동] GitHub 관련 통계는 실제 API에서 가져와야 함
  // 현재는 Task 개수 기반으로 임의의 값 생성 (Mock)
  const activityFactor = Math.min(dailyTasks.length, 20);

  return {
    focusTime: formatTimeFromSeconds(totalFocusTime),
    completedTasks: String(completedCount),
    push: String(Math.floor(activityFactor * 0.3)), // TODO: [API 연동] GitHub API에서 실제 push 횟수 가져오기
    issue: String(Math.floor(activityFactor * 0.15)), // TODO: [API 연동] GitHub API에서 실제 issue 생성 횟수 가져오기
    prCreated: String(Math.floor(activityFactor * 0.1)), // TODO: [API 연동] GitHub API에서 실제 PR 생성 횟수 가져오기
    prReview: String(Math.floor(activityFactor * 0.2)), // TODO: [API 연동] GitHub API에서 실제 PR 리뷰 횟수 가져오기
  };
}
