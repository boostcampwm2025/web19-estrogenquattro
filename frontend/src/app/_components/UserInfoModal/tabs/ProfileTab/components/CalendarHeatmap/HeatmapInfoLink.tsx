import { HelpCircle } from "lucide-react";

export function HeatmapInfoLink() {
  const handleClick = () => {
    // TODO: 포인트 획득 방법 설명 모달/페이지 열기
  };

  return (
    <button
      onClick={handleClick}
      className="flex cursor-pointer items-center gap-1 text-xs text-amber-700 transition-colors hover:text-amber-900"
    >
      <HelpCircle className="h-3 w-3" />
      <span>포인트 획득 정책</span>
    </button>
  );
}
