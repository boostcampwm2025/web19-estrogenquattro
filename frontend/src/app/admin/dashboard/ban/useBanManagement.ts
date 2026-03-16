"use client";

import { useEffect, useRef, useState } from "react";
import {
  getPlayers,
  banPlayer,
  unbanPlayer,
  type AdminPlayer,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

export function useBanManagement() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<AdminPlayer | null>(null);
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlayers = async (query?: string) => {
    setIsLoading(true);
    try {
      const data = await getPlayers(query);
      setPlayers(data);
    } catch {
      setToast({
        message: "유저 목록을 불러올 수 없습니다.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchPlayers(search || undefined);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const closeConfirm = () => {
    setConfirmTarget(null);
    setReason("");
  };

  const executeAction = async () => {
    if (!confirmTarget) return;
    setIsProcessing(true);

    try {
      if (confirmTarget.isBanned) {
        await unbanPlayer(confirmTarget.id);
        setToast({
          message: `${confirmTarget.nickname}의 밴을 해제했습니다.`,
          variant: "success",
        });
      } else {
        await banPlayer(confirmTarget.id, reason || undefined);
        setToast({
          message: `${confirmTarget.nickname}을(를) 밴했습니다.`,
          variant: "success",
        });
      }
      setReason("");
      await fetchPlayers(search || undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setToast({
          message: "해당 유저를 찾을 수 없습니다.",
          variant: "error",
        });
      } else {
        setToast({ message: "요청에 실패했습니다.", variant: "error" });
      }
    } finally {
      setIsProcessing(false);
      setConfirmTarget(null);
    }
  };

  return {
    players,
    search,
    setSearch,
    isLoading,
    confirmTarget,
    setConfirmTarget,
    reason,
    setReason,
    isProcessing,
    toast,
    setToast,
    closeConfirm,
    executeAction,
  };
}
