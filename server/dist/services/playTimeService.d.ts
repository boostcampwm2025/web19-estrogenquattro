declare class PlayTimeService {
    private readonly sessionTimers;
    private readonly userMinutes;
    startTimer(socketId: string, username: string, onMinute: (minutes: number) => void, connectedAt: Date): void;
    stopTimer(socketId: string): void;
    getUserMinutes(username: string): number;
    private handleTimer;
}
export declare const playTimeService: PlayTimeService;
export {};
//# sourceMappingURL=playTimeService.d.ts.map