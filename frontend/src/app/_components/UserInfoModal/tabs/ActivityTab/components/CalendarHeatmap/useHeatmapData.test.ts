import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHeatmapData, DailyPoints } from "./useHeatmapData";

describe("useHeatmapData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026년 1월 29일 (목요일)로 고정
    vi.setSystemTime(new Date(2026, 0, 29, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("yearData", () => {
    it("1년치 날짜 데이터를 생성한다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      // 2025-01-29 ~ 2026-01-29 = 366일 (2025년은 평년, 2026년 1월까지)
      expect(result.current.yearData.length).toBe(366);
    });

    it("첫 날은 정확히 1년 전이다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      const firstDay = result.current.yearData[0];
      expect(firstDay.date.getFullYear()).toBe(2025);
      expect(firstDay.date.getMonth()).toBe(0); // 1월
      expect(firstDay.date.getDate()).toBe(29);
    });

    it("마지막 날은 오늘이다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      const lastDay =
        result.current.yearData[result.current.yearData.length - 1];
      expect(lastDay.date.getFullYear()).toBe(2026);
      expect(lastDay.date.getMonth()).toBe(0); // 1월
      expect(lastDay.date.getDate()).toBe(29);
    });

    it("포인트 데이터를 올바르게 매핑한다", () => {
      const dailyPoints: DailyPoints = new Map([
        ["2026-01-27", 10],
        ["2026-01-28", 5],
        ["2026-01-29", 20],
      ]);
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      const lastThreeDays = result.current.yearData.slice(-3);
      expect(lastThreeDays[0].value).toBe(10);
      expect(lastThreeDays[1].value).toBe(5);
      expect(lastThreeDays[2].value).toBe(20);
    });

    it("포인트가 없는 날은 0을 할당한다", () => {
      const dailyPoints: DailyPoints = new Map([["2026-01-29", 10]]);
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      // 오늘 제외한 나머지는 모두 0
      const nonTodayDays = result.current.yearData.slice(0, -1);
      expect(nonTodayDays.every((day) => day.value === 0)).toBe(true);
    });
  });

  describe("weeks", () => {
    it("yearData를 주 단위로 그룹화한다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      // 모든 주는 7일씩
      result.current.weeks.forEach((week) => {
        expect(week).toHaveLength(7);
      });
    });

    it("첫 주의 빈 칸을 -1로 채운다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      const firstWeek = result.current.weeks[0];
      // 2025-01-29는 수요일이므로, 앞에 3칸(일월화)이 빈칸
      const emptyDays = firstWeek.filter((day) => day.value === -1);
      expect(emptyDays.length).toBe(3);
    });

    it("마지막 주의 빈 칸을 -1로 채운다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      const lastWeek = result.current.weeks[result.current.weeks.length - 1];
      // 2026-01-29는 목요일이므로, 뒤에 2칸(금토)이 빈칸
      const emptyDays = lastWeek.filter((day) => day.value === -1);
      expect(emptyDays.length).toBe(2);
    });

    it("빈 칸의 날짜는 1970-01-01이다", () => {
      const dailyPoints: DailyPoints = new Map();
      const { result } = renderHook(() => useHeatmapData(dailyPoints));

      const firstWeek = result.current.weeks[0];
      const emptyDay = firstWeek.find((day) => day.value === -1);

      expect(emptyDay?.date.getTime()).toBe(0);
    });

    it("dailyPoints 변경 시 재계산된다", () => {
      const { result, rerender } = renderHook(
        ({ points }) => useHeatmapData(points),
        {
          initialProps: {
            points: new Map([["2026-01-29", 10]]) as DailyPoints,
          },
        },
      );

      const firstValue =
        result.current.yearData[result.current.yearData.length - 1].value;
      expect(firstValue).toBe(10);

      // dailyPoints 변경
      rerender({ points: new Map([["2026-01-29", 20]]) });

      const secondValue =
        result.current.yearData[result.current.yearData.length - 1].value;
      expect(secondValue).toBe(20);
    });
  });
});
