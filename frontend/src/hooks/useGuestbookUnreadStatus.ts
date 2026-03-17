"use client";

import { useSyncExternalStore } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useGuestbookLatestEntry } from "@/lib/api/hooks/useGuestbook";
import {
  getLastReadGuestbookEntryId,
  hasUnreadGuestbookEntries,
  markGuestbookEntryAsRead,
  subscribeGuestbookReadMarker,
} from "@/lib/guestbookUnread";

export function useGuestbookUnreadStatus() {
  const playerId = useAuthStore((state) => state.user?.playerId ?? null);
  const lastReadEntryId = useSyncExternalStore(
    (onStoreChange) => {
      if (playerId === null) {
        return () => {};
      }

      return subscribeGuestbookReadMarker(playerId, onStoreChange);
    },
    () => {
      if (playerId === null) {
        return 0;
      }

      return getLastReadGuestbookEntryId(playerId);
    },
    () => 0,
  );

  const { data: latestEntry } = useGuestbookLatestEntry(playerId !== null);
  const latestEntryId = latestEntry?.id ?? null;

  return {
    hasUnread:
      playerId !== null &&
      hasUnreadGuestbookEntries(latestEntryId, lastReadEntryId),
    latestEntryId,
    markAsRead: () => {
      if (playerId === null || latestEntryId === null) {
        return;
      }

      markGuestbookEntryAsRead(playerId, latestEntryId);
    },
  };
}
