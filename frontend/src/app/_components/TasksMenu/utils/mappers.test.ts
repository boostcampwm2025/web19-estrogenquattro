import { describe, it, expect } from "vitest";
import { mapTaskResToTask } from "./mappers";
import { TaskRes } from "@/lib/api";

describe("mappers", () => {
  describe("mapTaskResToTask", () => {
    it("TaskRes를 Task로 변환한다", () => {
      const taskRes: TaskRes = {
        id: 1,
        description: "테스트 작업",
        isCompleted: false,
        totalFocusSeconds: 3600,
        createdAt: "2024-01-15T10:30:00Z",
      };

      const result = mapTaskResToTask(taskRes);

      expect(result).toEqual({
        id: 1,
        description: "테스트 작업",
        completed: false,
        time: 3600,
        baseTime: 3600,
        startTimestamp: null,
        isRunning: false,
        createdAt: "2024-01-15T10:30:00Z",
      });
    });

    it("완료된 작업을 올바르게 변환한다", () => {
      const taskRes: TaskRes = {
        id: 2,
        description: "완료된 작업",
        isCompleted: true,
        totalFocusSeconds: 7200,
        createdAt: "2024-01-15T09:00:00Z",
      };

      const result = mapTaskResToTask(taskRes);

      expect(result.completed).toBe(true);
      expect(result.time).toBe(7200);
      expect(result.baseTime).toBe(7200);
    });

    it("시간이 0인 작업을 올바르게 변환한다", () => {
      const taskRes: TaskRes = {
        id: 3,
        description: "새 작업",
        isCompleted: false,
        totalFocusSeconds: 0,
        createdAt: "2024-01-15T11:00:00Z",
      };

      const result = mapTaskResToTask(taskRes);

      expect(result.time).toBe(0);
      expect(result.baseTime).toBe(0);
      expect(result.isRunning).toBe(false);
      expect(result.startTimestamp).toBeNull();
    });
  });
});
