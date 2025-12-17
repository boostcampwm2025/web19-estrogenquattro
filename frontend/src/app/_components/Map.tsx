"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { gameConfig } from "@/game/config";

export default function Map() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // 이미 게임이 생성되어 있으면 return
    if (gameRef.current) return;

    // Phaser 게임 생성
    gameRef.current = new Phaser.Game(gameConfig);

    // 컴포넌트 언마운트 시 게임 정리
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return <div id="game-container" className="h-full w-full" />;
}
