const GUESTBOOK_READ_MARKER_PREFIX = "guestbook:last-read-entry-id";
const GUESTBOOK_READ_MARKER_EVENT = "guestbook_read_marker_update";

interface GuestbookReadMarkerDetail {
  playerId: number;
  lastReadEntryId: number;
}

function parseEntryId(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getGuestbookReadMarkerStorageKey(playerId: number): string {
  return `${GUESTBOOK_READ_MARKER_PREFIX}:${playerId}`;
}

export function getLastReadGuestbookEntryId(playerId: number): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return parseEntryId(
    window.localStorage.getItem(getGuestbookReadMarkerStorageKey(playerId)),
  );
}

export function hasUnreadGuestbookEntries(
  latestEntryId: number | null,
  lastReadEntryId: number,
): boolean {
  return latestEntryId !== null && latestEntryId > lastReadEntryId;
}

export function markGuestbookEntryAsRead(
  playerId: number,
  entryId: number,
): number {
  if (
    typeof window === "undefined" ||
    !Number.isFinite(entryId) ||
    entryId <= 0
  ) {
    return 0;
  }

  const lastReadEntryId = getLastReadGuestbookEntryId(playerId);
  const nextEntryId = Math.max(lastReadEntryId, Math.trunc(entryId));

  window.localStorage.setItem(
    getGuestbookReadMarkerStorageKey(playerId),
    String(nextEntryId),
  );
  window.dispatchEvent(
    new CustomEvent<GuestbookReadMarkerDetail>(GUESTBOOK_READ_MARKER_EVENT, {
      detail: { playerId, lastReadEntryId: nextEntryId },
    }),
  );

  return nextEntryId;
}

export function subscribeGuestbookReadMarker(
  playerId: number,
  onChange: (lastReadEntryId: number) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const storageKey = getGuestbookReadMarkerStorageKey(playerId);

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<GuestbookReadMarkerDetail>;

    if (customEvent.detail?.playerId !== playerId) {
      return;
    }

    onChange(customEvent.detail.lastReadEntryId);
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== storageKey) {
      return;
    }

    onChange(parseEntryId(event.newValue));
  };

  window.addEventListener(GUESTBOOK_READ_MARKER_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(GUESTBOOK_READ_MARKER_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
