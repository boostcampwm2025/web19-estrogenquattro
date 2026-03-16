import { fetchApi } from "./client";

export async function verifyAdmin(): Promise<{ isAdmin: boolean }> {
  return fetchApi<{ isAdmin: boolean }>("/api/admin/verification");
}
