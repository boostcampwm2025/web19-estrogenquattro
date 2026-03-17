"use client";

import { useAuthStore } from "@/stores/authStore";
import {
  useGuestbookReadState,
  useMarkGuestbookAsRead,
} from "@/lib/api/hooks/useGuestbook";

export function useGuestbookUnreadStatus() {
  const playerId = useAuthStore((state) => state.user?.playerId ?? null);
  const { data: readState } = useGuestbookReadState(playerId !== null);
  const markAsReadMutation = useMarkGuestbookAsRead();
  const latestEntryId = readState?.latestEntryId ?? null;

  return {
    hasUnread: playerId !== null && (readState?.hasUnread ?? false),
    latestEntryId,
    markAsRead: async () => {
      if (playerId === null || latestEntryId === null) {
        return;
      }

      await markAsReadMutation.mutateAsync();
    },
  };
}
