import { http, HttpResponse } from "msw";

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

export const resetGuestbookStore = () => {
  nextGuestbookId = 1;
  guestbookEntries = [];
};

export const seedGuestbookEntries = (entries: GuestbookEntry[]) => {
  guestbookEntries = [...entries];
  nextGuestbookId =
    entries.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
};

export const guestbookHandlers = [
  http.get("*/api/guestbooks", ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
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
    const nextCursor = filtered.length > limit ? items[items.length - 1].id : null;

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
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.delete("*/api/guestbooks/:id", ({ params }) => {
    const id = Number(params.id);
    guestbookEntries = guestbookEntries.filter((entry) => entry.id !== id);
    return new HttpResponse(null, { status: 200 });
  }),
];
