export interface GuestbookEntry {
  id: number;
  content: string;
  createdAt: string;
  player: {
    id: number;
    nickname: string;
  };
}
