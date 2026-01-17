import Image from "next/image";
import Mascot from "./Mascot";

export default function GrassCard() {
  return (
    <div className="relative size-60 shrink-0 overflow-visible rounded-none">
      {/* 잔디 배경 이미지 */}
      <Image
        src="/assets/grass-base.png"
        alt="Garden"
        fill
        className="scale-115 object-fill"
        style={{ imageRendering: "pixelated" }}
        priority
      />

      {/* 3x3 그리드 (마스코트 배치용) */}
      <div className="relative grid h-full w-full grid-cols-3 grid-rows-3 p-2">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="relative flex items-center justify-center"
          >
            {index === 0 && (
              <Mascot src="/assets/mascot/gopher_stage1.svg" alt="Gopher" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
