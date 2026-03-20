import { http, HttpResponse } from "msw";
import type { GuestbookReadStateRes } from "@/lib/api/guestbook";

type GuestbookEntry = {
  id: number;
  content: string;
  createdAt: string;
  player: {
    id: number;
    nickname: string;
  };
};

let nextGuestbookId = 1;
let guestbookEntries: GuestbookEntry[] = [];
let guestbookReadState: GuestbookReadStateRes = {
  latestEntryId: null,
  lastReadEntryId: 0,
  hasUnread: false,
};
let failMarkAsReadOnce = false;

export const resetGuestbookStore = () => {
  nextGuestbookId = 1;
  guestbookEntries = [];
  guestbookReadState = {
    latestEntryId: null,
    lastReadEntryId: 0,
    hasUnread: false,
  };
  failMarkAsReadOnce = false;
};

export const seedGuestbookEntries = (entries: GuestbookEntry[]) => {
  guestbookEntries = [...entries];
  nextGuestbookId =
    entries.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
  guestbookReadState.latestEntryId = entries.reduce(
    (max, entry) => Math.max(max, entry.id),
    0,
  );
};

export const setGuestbookReadState = (state: GuestbookReadStateRes) => {
  guestbookReadState = { ...state };
};

export const failNextMarkAsRead = () => {
  failMarkAsReadOnce = true;
};

export const guestbookHandlers = [
  http.get("*/api/guestbooks", ({ request }) => {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;
    const cursorParam = url.searchParams.get("cursor");
    const order = (url.searchParams.get("order") ?? "DESC").toUpperCase();

    const sorted = [...guestbookEntries].sort((left, right) =>
      order === "ASC" ? left.id - right.id : right.id - left.id,
    );

    let filtered = sorted;
    if (cursorParam) {
      const cursor = Number(cursorParam);
      filtered = sorted.filter((entry) =>
        order === "ASC" ? entry.id > cursor : entry.id < cursor,
      );
    }

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > items.length;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return HttpResponse.json({ items, nextCursor });
  }),

  http.post("*/api/guestbooks", async ({ request }) => {
    const body = (await request.json()) as { content: string };
    const entry: GuestbookEntry = {
      id: nextGuestbookId++,
      content: body.content.trim(),
      createdAt: new Date("2026-03-17T00:00:00.000Z").toISOString(),
      player: { id: 1, nickname: "테스트유저" },
    };
    guestbookEntries.unshift(entry);
    guestbookReadState = {
      latestEntryId: entry.id,
      lastReadEntryId: entry.id,
      hasUnread: false,
    };
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.get("*/api/guestbooks/read-state", () =>
    HttpResponse.json(guestbookReadState, { status: 200 }),
  ),

  http.post("*/api/guestbooks/read", () => {
    if (failMarkAsReadOnce) {
      failMarkAsReadOnce = false;
      return HttpResponse.json(
        { message: "markAsRead failed" },
        { status: 500 },
      );
    }

    const latestEntryId = guestbookEntries.reduce(
      (max, entry) => Math.max(max, entry.id),
      0,
    );

    guestbookReadState = {
      latestEntryId: latestEntryId || null,
      lastReadEntryId: latestEntryId,
      hasUnread: false,
    };

    return HttpResponse.json(guestbookReadState, { status: 200 });
  }),

  http.delete("*/api/guestbooks/:id", ({ params }) => {
    const id = Number(params.id);
    guestbookEntries = guestbookEntries.filter((entry) => entry.id !== id);
    return new HttpResponse(null, { status: 200 });
  }),
];
