import { create } from "zustand";

interface RoomState {
  roomId: string;
  pendingRoomId: string | null;
  setRoomId: (roomId: string) => void;
  setPendingRoomId: (roomId: string | null) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: "",
  pendingRoomId: null,
  setRoomId: (roomId) => set({ roomId }),
  setPendingRoomId: (pendingRoomId) => set({ pendingRoomId }),
}));
