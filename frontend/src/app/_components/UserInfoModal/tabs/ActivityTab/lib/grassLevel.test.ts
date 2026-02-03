import { describe, it, expect } from "vitest";
import {
  calculateGrassLevel,
  getGrassImagePath,
  getGrassImageFromData,
  getHeatmapColorClass,
} from "./grassLevel";
import { DailyPoints } from "../components/CalendarHeatmap/useHeatmapData";

describe("grassLevel", () => {
  describe("calculateGrassLevel", () => {
    it("0 포인트는 레벨 0을 반환한다", () => {
      const dailyPoints: DailyPoints = new Map([["2026-01-29", 0]]);

      expect(calculateGrassLevel(dailyPoints, "2026-01-29")).toBe(0);
    });

    it("1-10 포인트는 레벨 1을 반환한다", () => {
      const dailyPoints: DailyPoints = new Map([
        ["2026-01-27", 1],
        ["2026-01-28", 5],
        ["2026-01-29", 10],
      ]);

      expect(calculateGrassLevel(dailyPoints, "2026-01-27")).toBe(1);
      expect(calculateGrassLevel(dailyPoints, "2026-01-28")).toBe(1);
      expect(calculateGrassLevel(dailyPoints, "2026-01-29")).toBe(1);
    });

    it("11-30 포인트는 레벨 2를 반환한다", () => {
      const dailyPoints: DailyPoints = new Map([
        ["2026-01-27", 11],
        ["2026-01-28", 20],
        ["2026-01-29", 30],
      ]);

      expect(calculateGrassLevel(dailyPoints, "2026-01-27")).toBe(2);
      expect(calculateGrassLevel(dailyPoints, "2026-01-28")).toBe(2);
      expect(calculateGrassLevel(dailyPoints, "2026-01-29")).toBe(2);
    });

    it("31+ 포인트는 레벨 3을 반환한다", () => {
      const dailyPoints: DailyPoints = new Map([
        ["2026-01-28", 31],
        ["2026-01-29", 50],
      ]);

      expect(calculateGrassLevel(dailyPoints, "2026-01-28")).toBe(3);
      expect(calculateGrassLevel(dailyPoints, "2026-01-29")).toBe(3);
    });

    it("데이터에 없는 날짜는 레벨 0을 반환한다", () => {
      const dailyPoints: DailyPoints = new Map([]);

      expect(calculateGrassLevel(dailyPoints, "2026-01-29")).toBe(0);
    });
  });

  describe("getGrassImagePath", () => {
    it("레벨 0은 grass_level_0.webp를 반환한다", () => {
      expect(getGrassImagePath(0)).toBe("/assets/grass/grass_level_0.webp");
    });

    it("레벨 1은 grass_level_1.webp를 반환한다", () => {
      expect(getGrassImagePath(1)).toBe("/assets/grass/grass_level_1.webp");
    });

    it("레벨 2는 grass_level_2.webp를 반환한다", () => {
      expect(getGrassImagePath(2)).toBe("/assets/grass/grass_level_2.webp");
    });

    it("레벨 3은 grass_level_3.webp를 반환한다", () => {
      expect(getGrassImagePath(3)).toBe("/assets/grass/grass_level_3.webp");
    });
  });

  describe("getGrassImageFromData", () => {
    it("포인트 데이터로부터 직접 이미지 경로를 계산한다", () => {
      const dailyPoints: DailyPoints = new Map([
        ["2026-01-26", 0],
        ["2026-01-27", 1],
        ["2026-01-28", 15],
        ["2026-01-29", 35],
      ]);

      expect(getGrassImageFromData(dailyPoints, "2026-01-26")).toBe(
        "/assets/grass/grass_level_0.webp",
      );
      expect(getGrassImageFromData(dailyPoints, "2026-01-27")).toBe(
        "/assets/grass/grass_level_1.webp",
      );
      expect(getGrassImageFromData(dailyPoints, "2026-01-28")).toBe(
        "/assets/grass/grass_level_2.webp",
      );
      expect(getGrassImageFromData(dailyPoints, "2026-01-29")).toBe(
        "/assets/grass/grass_level_3.webp",
      );
    });
  });

  describe("getHeatmapColorClass", () => {
    it("-1 포인트는 투명 클래스를 반환한다", () => {
      expect(getHeatmapColorClass(-1)).toBe("bg-transparent");
    });

    it("0 포인트는 empty 클래스를 반환한다", () => {
      expect(getHeatmapColorClass(0)).toBe("bg-heatmap-empty");
    });

    it("1-10 포인트는 level-1 클래스를 반환한다", () => {
      expect(getHeatmapColorClass(1)).toBe("bg-heatmap-level-1");
      expect(getHeatmapColorClass(5)).toBe("bg-heatmap-level-1");
      expect(getHeatmapColorClass(10)).toBe("bg-heatmap-level-1");
    });

    it("11-30 포인트는 level-2 클래스를 반환한다", () => {
      expect(getHeatmapColorClass(11)).toBe("bg-heatmap-level-2");
      expect(getHeatmapColorClass(20)).toBe("bg-heatmap-level-2");
      expect(getHeatmapColorClass(30)).toBe("bg-heatmap-level-2");
    });

    it("31+ 포인트는 level-3 클래스를 반환한다", () => {
      expect(getHeatmapColorClass(31)).toBe("bg-heatmap-level-3");
      expect(getHeatmapColorClass(50)).toBe("bg-heatmap-level-3");
    });
  });
});
