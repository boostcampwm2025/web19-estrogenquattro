"use client";

import { useContributionStore } from "@/stores/useContributionStore";

const MAX_DISPLAY_COUNT = 3;

export default function ContributionList() {
  const contributions = useContributionStore((state) => state.contributions);

  // 상위 3명만 정렬하여 표시
  const sorted = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_DISPLAY_COUNT);

  if (sorted.length === 0) return null;

  return (
    <div className="flex gap-2">
      {sorted.map(([name, count], index) => (
        <div
          key={name}
          className={`flex items-center gap-1 border-2 border-gray-700 px-2 py-0.5 text-xs shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] ${
            index === 0
              ? "bg-yellow-100"
              : index === 1
                ? "bg-gray-100"
                : "bg-orange-50"
          }`}
        >
          <span className="font-bold text-gray-700">
            {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
          </span>
          <span className="font-mono text-gray-800">{name}</span>
          <span className="font-bold text-green-600">{count}</span>
        </div>
      ))}
    </div>
  );
}
