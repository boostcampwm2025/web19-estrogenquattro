"use client";

import { useState, useRef } from "react";
import { HelpCircle } from "lucide-react";

// 포인트 획득 정책 데이터
const POINT_POLICIES = [
  { action: "집중 30분", points: 1 },
  { action: "커밋", points: 2 },
  { action: "PR 생성", points: 2 },
  { action: "PR 머지", points: 4 },
  { action: "PR 리뷰", points: 4 },
  { action: "이슈 생성", points: 1 },
  { action: "Task 완료", points: 1 },
];

export function HeatmapInfo() {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <>
      <div
        ref={containerRef}
        id="heatmap-info-link"
        className="flex cursor-pointer items-center gap-1 text-xs text-amber-700 transition-colors hover:text-amber-900"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <HelpCircle className="h-3 w-3" />
        <span>포인트 획득 정책</span>
      </div>

      {/* 호버 툴팁 */}
      {isHovered && (
        <div
          className="pointer-events-none fixed z-50 rounded-none border-2 border-amber-700 bg-amber-900 px-3 py-2 text-sm text-amber-50 shadow-[2px_2px_0px_0px_#000]"
          style={{
            left: position.x + 10,
            top: position.y + 10,
          }}
        >
          <div className="mb-2 flex justify-between gap-12 border-b border-amber-700 pb-1 font-bold text-amber-300">
            <span>활동</span>
            <span>포인트</span>
          </div>
          <div className="space-y-1">
            {POINT_POLICIES.map((policy, index) => (
              <div key={index} className="flex justify-between gap-4">
                <span>{policy.action}</span>
                <span className="text-amber-300">+{policy.points}P</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
