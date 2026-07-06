"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { gameConfig } from "@/game/config";
import type { PlayerInfoResponse } from "@/lib/api/pet";
import type { User } from "@/stores/authStore";

interface GameCanvasProps {
  user: User;
  player: PlayerInfoResponse;
}

export default function GameCanvas({ user, player }: GameCanvasProps) {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    gameRef.current = new Phaser.Game(gameConfig);

    const petImage = player.equippedPet?.actualImgUrl || null;
    gameRef.current.registry.set("user", { ...user, petImage });
  }, [user, player]);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return <div id="game-container" className="h-full w-full" />;
}
