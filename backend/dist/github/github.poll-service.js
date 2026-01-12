"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GithubPollService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubPollService = void 0;
const common_1 = require("@nestjs/common");
const github_gateway_1 = require("./github.gateway");
const POLL_INTERVAL = 30_000;
const POLL_INTERVAL_BACKOFF = 120_000;
let GithubPollService = GithubPollService_1 = class GithubPollService {
    githubGateway;
    logger = new common_1.Logger(GithubPollService_1.name);
    constructor(githubGateway) {
        this.githubGateway = githubGateway;
    }
    pollingSchedules = new Map();
    userBaselines = new Map();
    subscribeGithubEvent(connectedAt, clientId, roomId, username, accessToken) {
        const existingSchedule = this.pollingSchedules.get(username);
        if (existingSchedule) {
            existingSchedule.clientIds.add(clientId);
            this.logger.log(`Client ${clientId} joined existing poll for user: ${username}`);
            return;
        }
        const timeout = setTimeout(() => {
            void this.handlePoll(username);
        }, 1000);
        this.pollingSchedules.set(username, {
            timeout,
            username,
            accessToken,
            roomId,
            clientIds: new Set([clientId]),
        });
        const hasBaseline = this.userBaselines.has(username);
        if (!hasBaseline) {
            this.userBaselines.set(username, {
                lastCommitCounts: new Map(),
                lastPRCount: 0,
            });
        }
        this.logger.log(`GitHub polling started for user: ${username} (baseline: ${hasBaseline ? 'restored' : 'new'})`);
    }
    unsubscribeGithubEvent(clientId) {
        for (const [username, schedule] of this.pollingSchedules) {
            if (schedule.clientIds.has(clientId)) {
                schedule.clientIds.delete(clientId);
                if (schedule.clientIds.size === 0) {
                    clearTimeout(schedule.timeout);
                    this.pollingSchedules.delete(username);
                    this.logger.log(`GitHub polling stopped for user: ${username}`);
                }
                else {
                    this.logger.log(`Client ${clientId} left poll for user: ${username} (${schedule.clientIds.size} remaining)`);
                }
                return;
            }
        }
    }
    scheduleNextPoll(username, interval) {
        const schedule = this.pollingSchedules.get(username);
        if (!schedule)
            return;
        schedule.timeout = setTimeout(() => {
            void this.handlePoll(username);
        }, interval);
    }
    async handlePoll(username) {
        const schedule = this.pollingSchedules.get(username);
        if (!schedule)
            return;
        const result = await this.pollGithubEvents(username);
        let nextInterval;
        switch (result.status) {
            case 'new_events':
                nextInterval = POLL_INTERVAL;
                this.githubGateway.castGithubEventToRoom(result.data, schedule.roomId);
                break;
            case 'no_changes':
                nextInterval = POLL_INTERVAL;
                break;
            case 'rate_limited':
                nextInterval = result.retryAfter || POLL_INTERVAL_BACKOFF;
                this.logger.warn(`Rate limited for user: ${schedule.username}, retry after ${nextInterval}ms`);
                break;
            case 'error':
            default:
                nextInterval = POLL_INTERVAL;
                break;
        }
        this.logger.debug(`Next poll for ${username} in ${nextInterval / 1000}s (status: ${result.status})`);
        this.scheduleNextPoll(username, nextInterval);
    }
    async pollGithubEvents(username) {
        const schedule = this.pollingSchedules.get(username);
        if (!schedule)
            return { status: 'error' };
        const baseline = this.userBaselines.get(username);
        if (!baseline)
            return { status: 'error' };
        const { accessToken } = schedule;
        const query = `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            commitContributionsByRepository(maxRepositories: 10) {
              repository {
                name
                owner { login }
              }
              contributions(last: 10) {
                nodes {
                  occurredAt
                  commitCount
                }
              }
            }
            pullRequestContributions(last: 10) {
              nodes {
                occurredAt
              }
            }
          }
        }
      }
    `;
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        };
        const res = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, variables: { username } }),
        });
        this.logger.log(`[GitHub Poll] ${username} - HTTP ${res.status}, remaining: ${res.headers.get('X-RateLimit-Remaining')}`);
        if (res.status === 429) {
            const resetHeader = res.headers.get('X-RateLimit-Reset');
            let retryAfter = POLL_INTERVAL_BACKOFF;
            if (resetHeader) {
                const resetTime = parseInt(resetHeader, 10) * 1000;
                retryAfter = Math.max(resetTime - Date.now(), POLL_INTERVAL_BACKOFF);
            }
            return { status: 'rate_limited', retryAfter };
        }
        if (!res.ok) {
            this.logger.error(`GitHub API error: ${res.status} ${res.statusText}`);
            return { status: 'error' };
        }
        const json = (await res.json());
        if (json.errors) {
            this.logger.error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
            return { status: 'error' };
        }
        const contributionsCollection = json.data?.user?.contributionsCollection;
        if (!contributionsCollection) {
            this.logger.debug(`[${username}] No contributions data`);
            return { status: 'no_changes' };
        }
        const currentCommitCounts = new Map();
        for (const repo of contributionsCollection.commitContributionsByRepository ||
            []) {
            const repoName = `${repo.repository.owner.login}/${repo.repository.name}`;
            let totalCommits = 0;
            for (const node of repo.contributions.nodes || []) {
                totalCommits += node.commitCount;
            }
            currentCommitCounts.set(repoName, totalCommits);
        }
        const currentPRCount = contributionsCollection.pullRequestContributions?.nodes?.length || 0;
        const isFirstPoll = baseline.lastCommitCounts.size === 0;
        this.logger.log(`[${username}] GraphQL Response: ${currentCommitCounts.size} repos, ` +
            `total commits: ${[...currentCommitCounts.values()].reduce((a, b) => a + b, 0)}, ` +
            `PRs: ${currentPRCount}, isFirstPoll: ${isFirstPoll}`);
        const sortedRepos = [...currentCommitCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        if (sortedRepos.length > 0) {
            const top3Log = sortedRepos.map(([repo, count]) => {
                const prevCount = baseline.lastCommitCounts.get(repo) || 0;
                const diff = count - prevCount;
                return `${repo}: ${count} commits (${diff >= 0 ? '+' : ''}${diff})`;
            });
            this.logger.log(`[${username}] Top repos:\n  - ${top3Log.join('\n  - ')}`);
        }
        if (isFirstPoll) {
            baseline.lastCommitCounts = currentCommitCounts;
            baseline.lastPRCount = currentPRCount;
            this.logger.log(`[${username}] First poll - baseline set, no notification`);
            return { status: 'no_changes' };
        }
        let newCommitCount = 0;
        for (const [repo, count] of currentCommitCounts) {
            const prevCount = baseline.lastCommitCounts.get(repo) || 0;
            if (count > prevCount) {
                newCommitCount += count - prevCount;
            }
        }
        const newPRCount = Math.max(0, currentPRCount - baseline.lastPRCount);
        baseline.lastCommitCounts = currentCommitCounts;
        baseline.lastPRCount = currentPRCount;
        if (newCommitCount === 0 && newPRCount === 0) {
            this.logger.debug(`[${username}] No new contributions`);
            return { status: 'no_changes' };
        }
        this.logger.log(`[${username}] New contributions detected! Commits: +${newCommitCount}, PRs: +${newPRCount}`);
        return {
            status: 'new_events',
            data: {
                username,
                pushCount: newCommitCount,
                pullRequestCount: newPRCount,
            },
        };
    }
};
exports.GithubPollService = GithubPollService;
exports.GithubPollService = GithubPollService = GithubPollService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [github_gateway_1.GithubGateway])
], GithubPollService);
//# sourceMappingURL=github.poll-service.js.map