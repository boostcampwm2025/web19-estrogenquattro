import { describe, it, expect } from "vitest";
import { getTasksByDate, formatTimeFromSeconds } from "./dateStats";
import { Task } from "@/app/_components/TasksMenu/types";

describe("dateStats", () => {
  describe("getTasksByDate", () => {
    // 로컬 타임존 문자열로 생성
    const mockTasks: Task[] = [
      {
        id: 1,
        description: "오늘 할 일",
        completed: false,
        createdAt: new Date(2026, 0, 29, 10, 0, 0).toISOString(),
        time: 0,
        baseTime: 0,
        startTimestamp: null,
        isRunning: false,
      },
      {
        id: 2,
        description: "어제 할 일",
        completed: true,
        createdAt: new Date(2026, 0, 28, 10, 0, 0).toISOString(),
        time: 1800,
        baseTime: 1800,
        startTimestamp: null,
        isRunning: false,
      },
      {
        id: 3,
        description: "오늘 할 일 2",
        completed: false,
        createdAt: new Date(2026, 0, 29, 18, 0, 0).toISOString(),
        time: 0,
        baseTime: 0,
        startTimestamp: null,
        isRunning: false,
      },
    ];

    it("특정 날짜의 Task만 필터링한다", () => {
      const targetDate = new Date(2026, 0, 29);
      const filtered = getTasksByDate(mockTasks, targetDate);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe(1);
      expect(filtered[1].id).toBe(3);
    });

    it("해당 날짜에 Task가 없으면 빈 배열을 반환한다", () => {
      const targetDate = new Date(2026, 0, 27);
      const filtered = getTasksByDate(mockTasks, targetDate);

      expect(filtered).toEqual([]);
    });

    it("시간대가 다른 같은 날짜의 Task를 모두 포함한다", () => {
      const targetDate = new Date(2026, 0, 29, 23, 59, 59);
      const filtered = getTasksByDate(mockTasks, targetDate);

      expect(filtered).toHaveLength(2);
    });
  });

  describe("formatTimeFromSeconds", () => {
    it("초를 HH:MM:SS 형식으로 변환한다", () => {
      expect(formatTimeFromSeconds(3661)).toBe("01:01:01");
    });

    it("0초는 00:00:00으로 표시한다", () => {
      expect(formatTimeFromSeconds(0)).toBe("00:00:00");
    });

    it("1시간 미만은 00:MM:SS 형식으로 표시한다", () => {
      expect(formatTimeFromSeconds(1830)).toBe("00:30:30");
    });

    it("10시간 이상도 올바르게 표시한다", () => {
      expect(formatTimeFromSeconds(36000)).toBe("10:00:00");
    });

    it("한 자릿수는 0으로 패딩한다", () => {
      expect(formatTimeFromSeconds(125)).toBe("00:02:05");
    });

    it("정확히 1시간은 01:00:00으로 표시한다", () => {
      expect(formatTimeFromSeconds(3600)).toBe("01:00:00");
    });
  });
});
