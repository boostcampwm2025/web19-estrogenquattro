// GitHub 스타일 히트맵 색상 정책
export function getHeatmapColorClass(value: number): string {
  if (value === -1) return "bg-transparent";
  if (value === 0) return "bg-heatmap-empty";
  if (value < 5) return "bg-heatmap-level-1";
  if (value < 10) return "bg-heatmap-level-2";
  if (value < 20) return "bg-heatmap-level-3";
  return "bg-heatmap-level-4";
}
