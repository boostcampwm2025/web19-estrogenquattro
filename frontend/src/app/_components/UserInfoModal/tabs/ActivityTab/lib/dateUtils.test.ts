import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatDate, isSameDay, getDateRange } from "./dateUtils";

describe("dateUtils", () => {
  describe("formatDate", () => {
    it("날짜를 한국어 형식으로 포맷팅한다", () => {
      const date = new Date("2026-01-29T12:00:00");
      const formatted = formatDate(date);

      expect(formatted).toContain("2026");
      expect(formatted).toContain("1월");
      expect(formatted).toContain("29일");
    });

    it("요일을 포함한다", () => {
      const date = new Date("2026-01-29T12:00:00"); // 목요일
      const formatted = formatDate(date);

      expect(formatted).toContain("목");
    });
  });

  describe("isSameDay", () => {
    it("같은 날짜면 true를 반환한다", () => {
      const date1 = new Date("2026-01-29T10:00:00");
      const date2 = new Date("2026-01-29T18:00:00");

      expect(isSameDay(date1, date2)).toBe(true);
    });

    it("다른 날짜면 false를 반환한다", () => {
      const date1 = new Date("2026-01-29T12:00:00");
      const date2 = new Date("2026-01-30T12:00:00");

      expect(isSameDay(date1, date2)).toBe(false);
    });

    it("두 번째 인자가 undefined면 false를 반환한다", () => {
      const date1 = new Date("2026-01-29T12:00:00");

      expect(isSameDay(date1, undefined)).toBe(false);
    });
  });

  describe("getDateRange", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("지정한 일수 전부터 오늘까지의 범위를 반환한다", () => {
      const now = new Date("2026-01-29T12:00:00");
      vi.setSystemTime(now);

      const { startDate, endDate } = getDateRange(7);

      expect(endDate.toDateString()).toBe(now.toDateString());
      expect(startDate.toDateString()).toBe(
        new Date("2026-01-22T12:00:00").toDateString(),
      );
    });

    it("0일 전이면 오늘만 반환한다", () => {
      const now = new Date("2026-01-29T12:00:00");
      vi.setSystemTime(now);

      const { startDate, endDate } = getDateRange(0);

      expect(startDate.toDateString()).toBe(endDate.toDateString());
    });

    it("365일 전부터의 범위를 계산한다", () => {
      const now = new Date("2026-01-29T12:00:00");
      vi.setSystemTime(now);

      const { startDate, endDate } = getDateRange(365);

      const expectedStart = new Date("2025-01-29T12:00:00");
      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
      expect(endDate.toDateString()).toBe(now.toDateString());
    });
  });
});
