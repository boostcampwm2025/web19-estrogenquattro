import { logger } from '../config/logger.js';
// 폴링 간격 설정 (밀리초)
const POLL_INTERVAL = 30_000; // 30초마다 폴링
const POLL_INTERVAL_BACKOFF = 120_000; // 429 응답 시 (rate limit)
class GithubPollService {
    // username -> PollingSchedule (username 기준으로 중복 방지)
    pollingSchedules = new Map();
    // username -> 기준점 (새로고침해도 유지)
    userBaselines = new Map();
    // username -> 이벤트 콜백
    eventCallbacks = new Map();
    subscribe(clientId, roomId, username, accessToken, onEvent) {
        const existingSchedule = this.pollingSchedules.get(username);
        // 이미 해당 username에 대한 폴링이 있으면 clientId만 추가
        if (existingSchedule) {
            existingSchedule.clientIds.add(clientId);
            logger.info(`Client ${clientId} joined existing poll for user: ${username}`);
            return;
        }
        // 콜백 저장
        this.eventCallbacks.set(username, onEvent);
        // 첫 폴링은 바로 시작
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
        // 기준점이 없으면 새로 생성 (있으면 유지 - 새로고침 시 복원)
        const hasBaseline = this.userBaselines.has(username);
        if (!hasBaseline) {
            this.userBaselines.set(username, {
                lastCommitCounts: new Map(),
                lastPRCount: 0,
            });
        }
        logger.info(`GitHub polling started for user: ${username} (baseline: ${hasBaseline ? 'restored' : 'new'})`);
    }
    unsubscribe(clientId) {
        // clientId로 해당하는 username 찾기
        for (const [username, schedule] of this.pollingSchedules) {
            if (schedule.clientIds.has(clientId)) {
                schedule.clientIds.delete(clientId);
                // 더 이상 연결된 클라이언트가 없으면 폴링 중지
                if (schedule.clientIds.size === 0) {
                    clearTimeout(schedule.timeout);
                    this.pollingSchedules.delete(username);
                    this.eventCallbacks.delete(username);
                    logger.info(`GitHub polling stopped for user: ${username}`);
                }
                else {
                    logger.info(`Client ${clientId} left poll for user: ${username} (${schedule.clientIds.size} remaining)`);
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
        // 다음 폴링 간격 결정
        let nextInterval;
        switch (result.status) {
            case 'new_events':
                nextInterval = POLL_INTERVAL;
                // 이벤트 콜백 호출
                const callback = this.eventCallbacks.get(username);
                if (callback && result.data) {
                    callback(result.data);
                }
                break;
            case 'no_changes':
                nextInterval = POLL_INTERVAL;
                break;
            case 'rate_limited':
                nextInterval = result.retryAfter || POLL_INTERVAL_BACKOFF;
                logger.warn(`Rate limited for user: ${schedule.username}, retry after ${nextInterval}ms`);
                break;
            case 'error':
            default:
                nextInterval = POLL_INTERVAL;
                break;
        }
        logger.debug(`Next poll for ${username} in ${nextInterval / 1000}s (status: ${result.status})`);
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
        // GraphQL API 사용 (REST API 캐시 문제 우회)
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
        let res;
        try {
            res = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables: { username } }),
            });
        }
        catch (error) {
            logger.error(`GitHub API fetch error: ${error}`);
            return { status: 'error' };
        }
        logger.info(`[GitHub Poll] ${username} - HTTP ${res.status}, remaining: ${res.headers.get('X-RateLimit-Remaining')}`);
        // 429 Too Many Requests - rate limit 초과
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
            logger.error(`GitHub API error: ${res.status} ${res.statusText}`);
            return { status: 'error' };
        }
        const json = (await res.json());
        if (json.errors) {
            logger.error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
            return { status: 'error' };
        }
        const contributionsCollection = json.data?.user?.contributionsCollection;
        if (!contributionsCollection) {
            logger.debug(`[${username}] No contributions data`);
            return { status: 'no_changes' };
        }
        // 커밋 기여 파싱 - 리포지토리별 총 커밋 수 계산
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
        // PR 기여 파싱 - 총 개수
        const currentPRCount = contributionsCollection.pullRequestContributions?.nodes?.length || 0;
        // 기준점이 비어있으면 첫 폴링 (새로고침 후에도 기존 기준점이 있으면 false)
        const isFirstPoll = baseline.lastCommitCounts.size === 0;
        logger.info(`[${username}] GraphQL Response: ${currentCommitCounts.size} repos, ` +
            `total commits: ${[...currentCommitCounts.values()].reduce((a, b) => a + b, 0)}, ` +
            `PRs: ${currentPRCount}, isFirstPoll: ${isFirstPoll}`);
        // 상위 3개 리포지토리 로깅
        const sortedRepos = [...currentCommitCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        if (sortedRepos.length > 0) {
            const top3Log = sortedRepos.map(([repo, count]) => {
                const prevCount = baseline.lastCommitCounts.get(repo) || 0;
                const diff = count - prevCount;
                return `${repo}: ${count} commits (${diff >= 0 ? '+' : ''}${diff})`;
            });
            logger.info(`[${username}] Top repos:\n  - ${top3Log.join('\n  - ')}`);
        }
        // 첫 폴링이면 기준점만 설정하고 알림 안 보냄
        if (isFirstPoll) {
            baseline.lastCommitCounts = currentCommitCounts;
            baseline.lastPRCount = currentPRCount;
            logger.info(`[${username}] First poll - baseline set, no notification`);
            return { status: 'no_changes' };
        }
        // 새로운 커밋 수 계산 (커밋 수 증가분)
        let newCommitCount = 0;
        for (const [repo, count] of currentCommitCounts) {
            const prevCount = baseline.lastCommitCounts.get(repo) || 0;
            if (count > prevCount) {
                newCommitCount += count - prevCount;
            }
        }
        // 새로운 PR 수 계산
        const newPRCount = Math.max(0, currentPRCount - baseline.lastPRCount);
        // 기준점 갱신
        baseline.lastCommitCounts = currentCommitCounts;
        baseline.lastPRCount = currentPRCount;
        if (newCommitCount === 0 && newPRCount === 0) {
            logger.debug(`[${username}] No new contributions`);
            return { status: 'no_changes' };
        }
        logger.info(`[${username}] New contributions detected! Commits: +${newCommitCount}, PRs: +${newPRCount}`);
        return {
            status: 'new_events',
            data: {
                username,
                pushCount: newCommitCount,
                pullRequestCount: newPRCount,
            },
        };
    }
}
// 싱글톤 인스턴스
export const githubPollService = new GithubPollService();
//# sourceMappingURL=githubPollService.js.map