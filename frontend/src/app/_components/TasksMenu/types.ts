import { TaskRes } from "@/lib/api";

// 프론트엔드 내부 타입 (로컬 상태 포함)
export interface Task {
  id: number;
  text: string;
  completed: boolean;
  time: number; // 초 단위 (totalFocusMinutes * 60)
  isRunning?: boolean;
  createdDate: string; // YYYY-MM-DD
}

// TaskRes -> Task 변환 함수
export function mapTaskResToTask(res: TaskRes): Task {
  return {
    id: res.id,
    text: res.description,
    completed: res.isCompleted,
    time: res.totalFocusMinutes * 60,
    isRunning: false,
    createdDate: res.createdDate,
  };
}
