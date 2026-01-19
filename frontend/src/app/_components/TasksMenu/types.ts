import { TaskRes } from "@/lib/api";

// 프론트엔드 내부 타입 (로컬 상태 포함)
export interface Task {
  id: number;
  description: string; // 백엔드 API와 필드명 통일
  completed: boolean;
  time: number; // 초 단위로 저장됨
  isRunning?: boolean;
  createdDate: string; // YYYY-MM-DD
}

// TaskRes -> Task 변환 함수
export function mapTaskResToTask(res: TaskRes): Task {
  return {
    id: res.id,
    description: res.description,
    completed: res.isCompleted,
    time: res.totalFocusMinutes * 60, // 분 -> 초 변환
    isRunning: false,
    createdDate: res.createdDate,
  };
}
