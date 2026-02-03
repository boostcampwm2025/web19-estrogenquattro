import { create } from "zustand";

interface RoomState {
  roomId: string;
  setRoomId: (roomId: string) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: "",
  setRoomId: (roomId) => set({ roomId }),
}));
