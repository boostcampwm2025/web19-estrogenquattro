// GitHub 스타일 히트맵 색상 정책
export function getHeatmapColorClass(value: number): string {
  if (value === -1) return "bg-transparent";
  if (value === 0) return "bg-heatmap-empty";
  if (value === 1) return "bg-heatmap-level-1"; // 1
  if (value < 10) return "bg-heatmap-level-2"; // 2-9
  if (value < 15) return "bg-heatmap-level-3"; // 10-14
  return "bg-heatmap-level-4"; // 15+
}
