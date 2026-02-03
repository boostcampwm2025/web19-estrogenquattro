export function HeatmapLegend() {
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-xs">
      <div className="mr-10 flex items-center gap-2 text-amber-800">
        <span className="opacity-80">less</span>
        <div className="flex gap-1">
          <div className="bg-heatmap-empty h-3 w-3 rounded-sm ring-1 ring-amber-300" />
          <div className="bg-heatmap-level-1 h-3 w-3 rounded-sm ring-1 ring-amber-300" />
          <div className="bg-heatmap-level-2 h-3 w-3 rounded-sm ring-1 ring-amber-300" />
          <div className="bg-heatmap-level-3 h-3 w-3 rounded-sm ring-1 ring-amber-300" />
        </div>
        <span className="opacity-80">more</span>
      </div>
    </div>
  );
}
