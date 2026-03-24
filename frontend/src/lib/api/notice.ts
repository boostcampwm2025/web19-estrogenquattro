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
  signal?: AbortSignal,
): Promise<NoticePaginationResponse> {
  return fetchApi<NoticePaginationResponse>(
    `/api/notices?page=${page}&limit=${limit}`,
    { signal },
  );
}
