import { create } from "zustand";

interface ConnectionState {
  isDisconnected: boolean;
  setDisconnected: (value: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isDisconnected: false,
  setDisconnected: (value) => set({ isDisconnected: value }),
}));
