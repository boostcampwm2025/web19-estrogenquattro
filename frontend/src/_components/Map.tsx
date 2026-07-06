"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { petApi } from "@/lib/api/pet";
import { useAuthStore } from "@/stores/authStore";
import { Loading } from "@/_components/ui/loading";

const GameCanvas = dynamic(() => import("./GameCanvas"), {
  ssr: false,
  loading: () => <GameLoading />,
});

function GameLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loading size="lg" />
    </div>
  );
}

export default function Map() {
  const user = useAuthStore((state) => state.user);

  const { data: player } = useQuery({
    queryKey: ["player", "info", user?.playerId],
    queryFn: () => petApi.getPlayer(user!.playerId),
    enabled: !!user?.playerId,
  });

  useEffect(() => {
    void import("./GameCanvas");
  }, []);

  if (!user || !player) {
    return <GameLoading />;
  }

  return <GameCanvas user={user} player={player} />;
}
