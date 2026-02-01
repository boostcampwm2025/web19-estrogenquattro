"use client";

import { useContributionStore } from "@/stores/useContributionStore";

const MAX_DISPLAY_COUNT = 5;

export default function ContributionList() {
  const contributions = useContributionStore((state) => state.contributions);

  // 상위 5명만 정렬하여 표시
  const sorted = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_DISPLAY_COUNT);

  if (sorted.length === 0) return null;

  return (
    <div className="flex justify-center gap-3 font-mono text-sm text-gray-600">
      {sorted.map(([name, count]) => (
        <span key={name}>
          {name}:{count}
        </span>
      ))}
    </div>
  );
}
