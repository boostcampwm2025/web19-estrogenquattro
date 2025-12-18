"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { gameConfig } from "@/game/config";
import { useAuthStore } from "@/stores/authStore";

export default function Map() {
  const { user } = useAuthStore();
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // 이미 게임이 생성되어 있으면 return
    if (gameRef.current) return;

    // Phaser 게임 생성
    gameRef.current = new Phaser.Game(gameConfig);

    // [중요] 로그인된 유저 정보를 Phaser Registry에 저장
    if (user) {
      gameRef.current.registry.set("user", user);
    }

    // 컴포넌트 언마운트 시 게임 정리
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [user]);

  return <div id="game-container" className="h-full w-full" />;
}
