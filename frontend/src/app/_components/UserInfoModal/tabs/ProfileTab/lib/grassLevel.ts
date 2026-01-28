import { DailyPoint } from "../components/CalendarHeatmap/useHeatmapData";

// 레벨별 에셋 정의 (이미지 경로와 색상 클래스)
const GRASS_LEVEL_ASSETS = {
  0: {
    imagePath: "/assets/grass/grass_level_0.webp",
    colorClass: "bg-heatmap-empty",
  },
  1: {
    imagePath: "/assets/grass/grass_level_1.webp",
    colorClass: "bg-heatmap-level-1",
  },
  2: {
    imagePath: "/assets/grass/grass_level_2.webp",
    colorClass: "bg-heatmap-level-2",
  },
  3: {
    imagePath: "/assets/grass/grass_level_3.webp",
    colorClass: "bg-heatmap-level-3",
  },
} as const;

type GrassLevel = keyof typeof GRASS_LEVEL_ASSETS;

/**
 * 포인트 수에 따라 잔디 레벨을 계산합니다.
 * - 0 포인트: 레벨 0
 * - 1 포인트: 레벨 1
 * - 2-9 포인트: 레벨 2
 * - 10+ 포인트: 레벨 3
 */
function getLevel(points: number): GrassLevel {
  if (points === 0) return 0;
  if (points === 1) return 1;
  if (points < 10) return 2;
  return 3;
}

/**
 * 특정 날짜의 포인트를 기반으로 잔디 레벨을 계산합니다.
 * @param dailyPoints 전체 포인트 데이터 배열
 * @param targetDate 조회할 날짜 (YYYY-MM-DD 형식)
 */
export function calculateGrassLevel(dailyPoints: DailyPoint[], targetDate: string): GrassLevel {
  const dayData = dailyPoints.find(day => day.date === targetDate);
  const points = dayData?.points ?? 0;
  return getLevel(points);
}

/**
 * 잔디 레벨에 해당하는 이미지 경로를 반환합니다.
 */
export function getGrassImagePath(level: GrassLevel): string {
  return GRASS_LEVEL_ASSETS[level].imagePath;
}

/**
 * 히트맵 데이터로부터 직접 잔디 이미지 경로를 반환합니다.
 * @param dailyPoints 전체 포인트 데이터 배열
 * @param targetDate 조회할 날짜 (YYYY-MM-DD 형식)
 */
export function getGrassImageFromData(dailyPoints: DailyPoint[], targetDate: string): string {
  const level = calculateGrassLevel(dailyPoints, targetDate);
  return getGrassImagePath(level);
}

/**
 * 포인트 수에 따라 히트맵 색상 클래스를 반환합니다.
 */
export function getHeatmapColorClass(points: number): string {
  if (points === -1) return "bg-transparent";

  const level = getLevel(points);
  return GRASS_LEVEL_ASSETS[level].colorClass;
}
