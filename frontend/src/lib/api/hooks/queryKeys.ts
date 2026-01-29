export const queryKeys = {
  points: {
    all: ["points"] as const,
    list: (targetPlayerId: number) =>
      [...queryKeys.points.all, "list", targetPlayerId] as const,
  },
  focustime: {
    all: ["focustime"] as const,
    detail: (playerId: number, date: string) =>
      [...queryKeys.focustime.all, playerId, date] as const,
  },
  github: {
    all: ["github"] as const,
    events: (playerId: number, date: string) =>
      [...queryKeys.github.all, "events", playerId, date] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (playerId: number, date?: string) =>
      [...queryKeys.tasks.all, playerId, date] as const,
  },
};
