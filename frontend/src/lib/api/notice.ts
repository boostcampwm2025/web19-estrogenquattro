import { fetchApi } from "./client";

export interface NoticeAuthor {
  nickname: string;
}

export interface NoticeItem {
  id: number;
  titleKo: string;
  contentKo: string;
  titleEn: string;
  contentEn: string;
  createdAt: string;
  author: NoticeAuthor;
}

export interface NoticePaginationResponse {
  items: NoticeItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export async function getNotices(
  page: number = 1,
  limit: number = 10,
): Promise<NoticePaginationResponse> {
  return fetchApi<NoticePaginationResponse>(
    `/api/notices?page=${page}&limit=${limit}`,
  );
}

export async function getNewNotice(): Promise<NoticeItem | null> {
  const data = await fetchApi<NoticeItem | Record<string, never>>(
    "/api/notices/new",
  );
  if ("id" in data) return data as NoticeItem;
  return null;
}

export async function markNoticeAsRead(id: number): Promise<void> {
  await fetchApi(`/api/notices/${id}/marking`, { method: "POST" });
}
