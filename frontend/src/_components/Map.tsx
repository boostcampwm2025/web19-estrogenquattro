"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { useQuery } from "@tanstack/react-query";
import { petApi } from "@/lib/api/pet";
import { gameConfig } from "@/game/config";
import { useAuthStore } from "@/stores/authStore";

export default function Map() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const user = useAuthStore((state) => state.user);

  // 플레이어 정보 (장착 펫 포함) 미리 가져오기
  const { data: player } = useQuery({
    queryKey: ["player", "me"],
    queryFn: petApi.getPlayer,
    enabled: !!user, // 유저 정보가 있을 때만 실행
  });

  useEffect(() => {
    // 이미 게임이 생성되어 있으면 return
    if (gameRef.current) return;

    // 유저 정보와 플레이어 정보(펫)가 모두 준비되어야 게임 시작
    if (!user || !player) return;

    // Phaser 게임 생성
    gameRef.current = new Phaser.Game(gameConfig);

    // 로그인된 유저 정보 바탕으로 펫 정보를 Phaser Registry에 저장
    const petImage = player.equippedPet?.actualImgUrl || null;

    gameRef.current.registry.set("user", {
      ...user,
      petImage, // 장착된 펫 이미지 URL (없으면 null)
    });
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
