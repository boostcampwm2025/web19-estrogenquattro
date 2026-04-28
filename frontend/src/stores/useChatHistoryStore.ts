import { create } from "zustand";

export interface ChatHistoryEntry {
  id: string;
  roomId: string;
  channel: number;
  username: string;
  message: string;
  isMine: boolean;
  timestamp: number;
}

interface ChatHistoryStore {
  messages: ChatHistoryEntry[];
  addMessage: (entry: ChatHistoryEntry) => void;
  upsertMessages: (entries: ChatHistoryEntry[]) => void;
  clear: () => void;
}

function sortEntries(a: ChatHistoryEntry, b: ChatHistoryEntry): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }

  const aId = Number(a.id);
  const bId = Number(b.id);
  if (!Number.isNaN(aId) && !Number.isNaN(bId) && aId !== bId) {
    return aId - bId;
  }

  return a.id.localeCompare(b.id);
}

function mergeEntries(
  current: ChatHistoryEntry[],
  incoming: ChatHistoryEntry[],
): ChatHistoryEntry[] {
  const map = new Map(current.map((entry) => [entry.id, entry]));

  incoming.forEach((entry) => {
    map.set(entry.id, entry);
  });

  return Array.from(map.values()).sort(sortEntries);
}

export const useChatHistoryStore = create<ChatHistoryStore>((set) => ({
  messages: [],
  addMessage: (entry) =>
    set((state) => ({ messages: mergeEntries(state.messages, [entry]) })),
  upsertMessages: (entries) =>
    set((state) => ({ messages: mergeEntries(state.messages, entries) })),
  clear: () => set({ messages: [] }),
}));
