import { fetchApi } from "./client";

export interface AdminPlayer {
  id: number;
  nickname: string;
  isBanned: boolean;
  banReason: string | null;
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
