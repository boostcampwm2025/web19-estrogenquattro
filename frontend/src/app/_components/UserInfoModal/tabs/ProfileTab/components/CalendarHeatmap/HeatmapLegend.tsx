export function HeatmapLegend() {
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-xs">
      <div className="flex items-center gap-2 text-amber-800 mr-10">
        <span className="opacity-80">less</span>
        <div className="flex gap-1">
          <div className="h-3 w-3 rounded-sm bg-heatmap-empty ring-1 ring-amber-300" />
          <div className="h-3 w-3 rounded-sm bg-heatmap-level-1 ring-1 ring-amber-300" />
          <div className="h-3 w-3 rounded-sm bg-heatmap-level-2 ring-1 ring-amber-300" />
          <div className="h-3 w-3 rounded-sm bg-heatmap-level-3 ring-1 ring-amber-300" />
        </div>
        <span className="opacity-80">more</span>
      </div>
    </div>
  );
}
