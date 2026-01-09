export interface Task {
  id: string;
  text: string;
  completed: boolean;
  time: number; // 초 단위
  isRunning?: boolean;
}
