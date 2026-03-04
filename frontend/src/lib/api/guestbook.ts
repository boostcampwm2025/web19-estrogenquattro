import { fetchApi } from "./client";

export interface GuestbookPlayer {
  id: number;
  nickname: string;
}

export interface GuestbookEntryRes {
  id: number;
  content: string;
  createdAt: string;
  player: GuestbookPlayer;
}

export interface GuestbookListRes {
  items: GuestbookEntryRes[];
  nextCursor: number | null;
}

export const guestbookApi = {
  getEntries: (cursor?: number, limit: number = 20) => {
    const params = new URLSearchParams();
    if (cursor !== undefined) params.set("cursor", String(cursor));
    params.set("limit", String(limit));
    params.set("order", "DESC");
    const query = params.toString();
    return fetchApi<GuestbookListRes>(`/api/guestbooks?${query}`);
  },

  createEntry: (content: string) =>
    fetchApi<GuestbookEntryRes>("/api/guestbooks", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  deleteEntry: (id: number) =>
    fetchApi<void>(`/api/guestbooks/${id}`, {
      method: "DELETE",
    }),
};
