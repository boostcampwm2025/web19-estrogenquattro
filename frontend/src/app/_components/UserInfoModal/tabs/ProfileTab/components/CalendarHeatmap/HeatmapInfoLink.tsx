import { HelpCircle } from "lucide-react";

export function HeatmapInfoLink() {
  const handleClick = () => {
    // TODO: 포인트 획득 방법 설명 모달/페이지 열기
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
    >
      <HelpCircle className="h-3 w-3" />
      <span>포인트 획득 정책</span>
    </button>
  );
}
