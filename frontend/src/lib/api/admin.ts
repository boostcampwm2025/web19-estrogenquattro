import { fetchApi } from "./client";

export interface AdminPlayer {
  id: number;
  nickname: string;
  isBanned: boolean;
  banReason: string | null;
}

export interface AdminNotification {
  id: number;
  titleKo: string;
  contentKo: string;
  titleEn: string;
  contentEn: string;
  createdAt: string;
  updatedAt: string;
  author: { id: number; nickname: string };
}

export async function verifyAdmin(): Promise<{ isAdmin: boolean }> {
  return fetchApi<{ isAdmin: boolean }>("/api/admin/verification");
}

export async function getPlayers(search?: string): Promise<AdminPlayer[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return fetchApi<AdminPlayer[]>(`/api/admin/players${query}`);
}

export async function banPlayer(
  targetPlayerId: number,
  reason?: string,
): Promise<void> {
  await fetchApi("/api/admin/ban", {
    method: "POST",
    body: JSON.stringify({ targetPlayerId, reason }),
  });
}

export async function unbanPlayer(playerId: number): Promise<void> {
  await fetchApi(`/api/admin/ban/${playerId}`, {
    method: "DELETE",
  });
}

export interface AdminNotificationPaginationResponse {
  items: AdminNotification[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

// Notification CRUD (admin-only)
export async function getNotifications(page: number = 1, limit: number = 10): Promise<AdminNotificationPaginationResponse> {
  return fetchApi<AdminNotificationPaginationResponse>(`/api/notices?page=${page}&limit=${limit}`);
}

export async function createNotification(
  titleKo: string,
  contentKo: string,
  titleEn: string,
  contentEn: string,
): Promise<AdminNotification> {
  return fetchApi<AdminNotification>("/api/notices", {
    method: "POST",
    body: JSON.stringify({
      ko: { title: titleKo, content: contentKo },
      en: { title: titleEn, content: contentEn }
    }),
  });
}

export async function updateNotification(
  id: number,
  titleKo: string,
  contentKo: string,
  titleEn: string,
  contentEn: string,
): Promise<AdminNotification> {
  return fetchApi<AdminNotification>(`/api/notices/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ko: { title: titleKo, content: contentKo },
      en: { title: titleEn, content: contentEn }
    }),
  });
}

export async function deleteNotification(id: number): Promise<void> {
  await fetchApi(`/api/notices/${id}`, {
    method: "DELETE",
  });
}
