"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

interface MascotProps {
  src: string;
  alt?: string;
}

export default function Mascot({ src, alt = "Mascot" }: MascotProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasFloated, setHasFloated] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [shouldBounce, setShouldBounce] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!hasFloated) {
      setHasFloated(true);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setShouldBounce(true);
      setTimeout(() => setShouldBounce(false), 3000);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="group relative size-full">
      {/* 마스코트 */}
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        className={`relative size-full cursor-pointer transition-transform select-none ${
          isHovered ? "translate-y-1" : ""
        } ${isPressed ? "scale-125" : ""} ${shouldBounce ? "animate-grass-pet-bounce" : ""}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain select-none"
          draggable={false}
        />
      </button>

      {/* hover시 하트 애니메이션 */}
      <div
        className={`pointer-events-none absolute -top-4 left-1/2 transition-opacity duration-500 ${
          isHovered ? "opacity-80" : "opacity-0"
        } ${hasFloated ? "animate-grass-heart-float" : ""}`}
      >
        <div
          className={`transition-transform select-none ${isPressed ? "scale-125" : ""}`}
        >
          <Image
            src="/assets/heart.png"
            alt="Heart"
            width={24}
            height={24}
            className="object-contain select-none"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
