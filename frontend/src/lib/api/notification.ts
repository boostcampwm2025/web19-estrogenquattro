import { fetchApi } from "./client";

export interface NoticeItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  author: { nickname: string };
}

export async function getPublicNotifications(): Promise<NoticeItem[]> {
  return fetchApi<NoticeItem[]>("/api/public/notifications");
}
