import { fetchApi } from "./client";

export interface ChatMessageItem {
  id: number;
  roomId: string;
  nickname: string;
  message: string;
  createdAt: string;
}

export interface ChatMessagePage {
  items: ChatMessageItem[];
  nextCursor: number | null;
}

export const chatApi = {
  getMessages: (roomId: string, cursor?: number, signal?: AbortSignal) => {
    const params = new URLSearchParams({ roomId });
    if (cursor !== undefined) {
      params.set("cursor", String(cursor));
    }

    return fetchApi<ChatMessagePage>(`/api/chat-messages?${params.toString()}`, {
      signal,
    });
  },
};
