import { fetchApi } from "./client";

export interface RoomInfo {
  id: string; // "room-1"
  capacity: number;
  size: number;
}

export const roomApi = {
  getRooms: () => fetchApi<Record<string, RoomInfo>>("/api/rooms"),

  joinRoom: (roomId: string) =>
    fetchApi<void>(`/api/rooms/${roomId}`, {
      method: "PATCH",
    }),
};
