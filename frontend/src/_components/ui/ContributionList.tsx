"use client";

import Image from "next/image";
import { useContributionStore } from "@/stores/useContributionStore";

const MAX_DISPLAY_COUNT = 3;

// 메달 이미지 경로
const MEDAL_IMAGES = [
  "/assets/medal/gold.webp",
  "/assets/medal/silver.webp",
  "/assets/medal/bronze.webp",
];

export default function ContributionList() {
  const contributions = useContributionStore((state) => state.contributions);

  // 상위 3명만 정렬하여 표시
  const sorted = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_DISPLAY_COUNT);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-1 flex items-center justify-center gap-3">
      {sorted.map(([name], index) => (
        <div key={name} className="flex items-center gap-1">
          <Image
            src={MEDAL_IMAGES[index]}
            alt={`${index + 1}등 메달`}
            width={20}
            height={20}
            className="h-5 w-5"
          />
          <span
            className="font-neodunggeunmo text-sm font-bold text-white"
            style={{
              textShadow: `
                -1px -1px 0 black,
                1px -1px 0 black,
                -1px 1px 0 black,
                1px 1px 0 black
              `,
            }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
