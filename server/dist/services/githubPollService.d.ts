export interface GithubEventData {
    username: string;
    pushCount: number;
    pullRequestCount: number;
}
type EventCallback = (event: GithubEventData) => void;
declare class GithubPollService {
    private readonly pollingSchedules;
    private readonly userBaselines;
    private readonly eventCallbacks;
    subscribe(clientId: string, roomId: string, username: string, accessToken: string, onEvent: EventCallback): void;
    unsubscribe(clientId: string): void;
    private scheduleNextPoll;
    private handlePoll;
    private pollGithubEvents;
}
export declare const githubPollService: GithubPollService;
export {};
//# sourceMappingURL=githubPollService.d.ts.map