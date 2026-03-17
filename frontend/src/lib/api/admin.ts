import { fetchApi } from "./client";

export interface AdminPlayer {
  id: number;
  nickname: string;
  isBanned: boolean;
  banReason: string | null;
}

export interface AdminNotification {
  id: number;
  title: string;
  content: string;
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

// Notification CRUD (admin-only)
export async function getNotifications(): Promise<AdminNotification[]> {
  return fetchApi<AdminNotification[]>("/api/notifications");
}

export async function createNotification(
  title: string,
  content: string,
): Promise<AdminNotification> {
  return fetchApi<AdminNotification>("/api/notifications", {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });
}

export async function updateNotification(
  id: number,
  title: string,
  content: string,
): Promise<AdminNotification> {
  return fetchApi<AdminNotification>(`/api/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title, content }),
  });
}

export async function deleteNotification(id: number): Promise<void> {
  await fetchApi(`/api/notifications/${id}`, {
    method: "DELETE",
  });
}
