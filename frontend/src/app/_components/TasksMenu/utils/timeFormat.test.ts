import { describe, it, expect } from "vitest";
import { formatTime, formatTaskTime } from "./timeFormat";

describe("timeFormat", () => {
  describe("formatTime", () => {
    it("0초를 00:00:00으로 포맷한다", () => {
      expect(formatTime(0)).toBe("00:00:00");
    });

    it("59초를 00:00:59로 포맷한다", () => {
      expect(formatTime(59)).toBe("00:00:59");
    });

    it("1분을 00:01:00으로 포맷한다", () => {
      expect(formatTime(60)).toBe("00:01:00");
    });

    it("1시간을 01:00:00으로 포맷한다", () => {
      expect(formatTime(3600)).toBe("01:00:00");
    });

    it("1시간 23분 45초를 01:23:45로 포맷한다", () => {
      const seconds = 5025;
      expect(formatTime(seconds)).toBe("01:23:45");
    });

    it("10시간 이상도 올바르게 포맷한다", () => {
      const seconds = 12 * 3600 + 34 * 60 + 56;
      expect(formatTime(seconds)).toBe("12:34:56");
    });
  });

  describe("formatTaskTime", () => {
    it("formatTime과 동일하게 동작한다", () => {
      const testCases = [0, 59, 60, 3600, 5025];

      testCases.forEach((seconds) => {
        expect(formatTaskTime(seconds)).toBe(formatTime(seconds));
      });
    });
  });
});
