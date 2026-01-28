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
    events: (playerId: number, date: string) =>
      [...queryKeys.github.all, "events", playerId, date] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (playerId: number, date?: string) =>
      [...queryKeys.tasks.all, playerId, date] as const,
  },
  pets: {
    all: ["pets"] as const,
    inventory: (playerId: number) =>
      [...queryKeys.pets.all, "inventory", playerId] as const,
    codex: (playerId: number) =>
      [...queryKeys.pets.all, "codex", playerId] as const,
    allPets: () => [...queryKeys.pets.all, "all"] as const,
  },
  player: {
    all: ["player"] as const,
    info: (playerId: number) =>
      [...queryKeys.player.all, "info", playerId] as const,
  },
};
