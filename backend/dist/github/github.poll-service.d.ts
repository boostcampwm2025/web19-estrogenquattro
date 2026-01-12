import { GithubGateway } from './github.gateway';
export declare class GithubPollService {
    private readonly githubGateway;
    private readonly logger;
    constructor(githubGateway: GithubGateway);
    private readonly pollingSchedules;
    private readonly userBaselines;
    subscribeGithubEvent(connectedAt: Date, clientId: string, roomId: string, username: string, accessToken: string): void;
    unsubscribeGithubEvent(clientId: string): void;
    private scheduleNextPoll;
    private handlePoll;
    private pollGithubEvents;
}
