import { TaskRes } from "@/lib/api";

// 프론트엔드 내부 타입 (로컬 상태 포함)
export interface Task {
  id: number;
  description: string; // 백엔드 API와 필드명 통일
  completed: boolean;
  time: number; // 누적 시간 (휴식 시점까지, 초 단위)
  baseTime: number; // 현재 세션 시작 시점의 시간
  startTimestamp: number | null; // 타이머 시작 타임스탬프
  isRunning: boolean;
  createdAt: string; // ISO8601 UTC 문자열
}

// TaskRes -> Task 변환 함수
export function mapTaskResToTask(res: TaskRes): Task {
  return {
    id: res.id,
    description: res.description,
    completed: res.isCompleted,
    time: res.totalFocusSeconds,
    baseTime: res.totalFocusSeconds,
    startTimestamp: null,
    isRunning: false,
    createdAt: res.createdAt,
  };
}
