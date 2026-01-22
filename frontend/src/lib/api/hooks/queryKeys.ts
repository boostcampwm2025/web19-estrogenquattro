export const queryKeys = {
  points: {
    all: ["points"] as const,
    list: () => [...queryKeys.points.all, "list"] as const,
  },
  focustime: {
    all: ["focustime"] as const,
    detail: (playerId: number, date: string) =>
      [...queryKeys.focustime.all, playerId, date] as const,
  },
  github: {
    all: ["github"] as const,
    events: (date: string) =>
      [...queryKeys.github.all, "events", date] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (playerId: number, date?: string) =>
      [...queryKeys.tasks.all, playerId, date] as const,
  },
};
