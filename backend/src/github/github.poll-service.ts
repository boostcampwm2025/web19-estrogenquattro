import { Injectable, Logger } from '@nestjs/common';
import { GithubGateway } from './github.gateway';

// 폴링 간격 설정 (밀리초)
const POLL_INTERVAL = 30_000; // 30초마다 폴링
const POLL_INTERVAL_BACKOFF = 120_000; // 429 응답 시 (rate limit)

interface PollingSchedule {
  timeout: NodeJS.Timeout;
  lastProcessedAt: Date;
  username: string;
  accessToken: string;
  roomId: string;
  clientIds: Set<string>; // 같은 유저의 여러 클라이언트 추적
}

interface GithubEvent {
  type: string;
  created_at: string;
  repo?: {
    name: string;
  };
  actor?: {
    login: string;
  };
}

@Injectable()
export class GithubPollService {
  private readonly logger = new Logger(GithubPollService.name);

  constructor(private readonly githubGateway: GithubGateway) {}

  // username -> PollingSchedule (username 기준으로 중복 방지)
  private readonly pollingSchedules = new Map<string, PollingSchedule>();

  subscribeGithubEvent(
    connectedAt: Date,
    clientId: string,
    roomId: string,
    username: string,
    accessToken: string,
  ) {
    const existingSchedule = this.pollingSchedules.get(username);

    // 이미 해당 username에 대한 폴링이 있으면 clientId만 추가
    if (existingSchedule) {
      existingSchedule.clientIds.add(clientId);
      this.logger.log(
        `Client ${clientId} joined existing poll for user: ${username}`,
      );
      return;
    }

    // 첫 폴링은 바로 시작
    const timeout = setTimeout(() => {
      void this.handlePoll(username);
    }, 1000);

    // lastProcessedAt을 5분 전으로 설정하여 접속 전 이벤트도 감지
    const fiveMinutesAgo = new Date(connectedAt.getTime() - 5 * 60 * 1000);

    this.pollingSchedules.set(username, {
      timeout,
      lastProcessedAt: fiveMinutesAgo,
      username,
      accessToken,
      roomId,
      clientIds: new Set([clientId]),
    });

    this.logger.log(
      `GitHub polling started for user: ${username} (lastProcessedAt: ${fiveMinutesAgo.toISOString()})`,
    );
  }

  unsubscribeGithubEvent(clientId: string) {
    // clientId로 해당하는 username 찾기
    for (const [username, schedule] of this.pollingSchedules) {
      if (schedule.clientIds.has(clientId)) {
        schedule.clientIds.delete(clientId);

        // 더 이상 연결된 클라이언트가 없으면 폴링 중지
        if (schedule.clientIds.size === 0) {
          clearTimeout(schedule.timeout);
          this.pollingSchedules.delete(username);
          this.logger.log(`GitHub polling stopped for user: ${username}`);
        } else {
          this.logger.log(
            `Client ${clientId} left poll for user: ${username} (${schedule.clientIds.size} remaining)`,
          );
        }
        return;
      }
    }
  }

  private scheduleNextPoll(username: string, interval: number) {
    const schedule = this.pollingSchedules.get(username);
    if (!schedule) return;

    schedule.timeout = setTimeout(() => {
      void this.handlePoll(username);
    }, interval);
  }

  private async handlePoll(username: string) {
    const schedule = this.pollingSchedules.get(username);
    if (!schedule) return;

    const result = await this.pollGithubEvents(username);

    // 다음 폴링 간격 결정
    let nextInterval: number;
    switch (result.status) {
      case 'new_events':
        nextInterval = POLL_INTERVAL;
        this.githubGateway.castGithubEventToRoom(result.data!, schedule.roomId);
        break;
      case 'no_changes':
        nextInterval = POLL_INTERVAL;
        break;
      case 'rate_limited':
        nextInterval = result.retryAfter || POLL_INTERVAL_BACKOFF;
        this.logger.warn(
          `Rate limited for user: ${schedule.username}, retry after ${nextInterval}ms`,
        );
        break;
      case 'error':
      default:
        nextInterval = POLL_INTERVAL;
        break;
    }

    this.logger.debug(
      `Next poll for ${username} in ${nextInterval / 1000}s (status: ${result.status})`,
    );
    this.scheduleNextPoll(username, nextInterval);
  }

  private async pollGithubEvents(username: string): Promise<{
    status: 'new_events' | 'no_changes' | 'rate_limited' | 'error';
    data?: {
      username: string;
      pushCount: number;
      pullRequestCount: number;
    };
    retryAfter?: number;
  }> {
    const schedule = this.pollingSchedules.get(username);
    if (!schedule) return { status: 'error' };

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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: { username } }),
    });

    this.logger.log(
      `[GitHub Poll] ${username} - HTTP ${res.status}, remaining: ${res.headers.get('X-RateLimit-Remaining')}`,
    );

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
      this.logger.error(`GitHub API error: ${res.status} ${res.statusText}`);
      return { status: 'error' };
    }

    const json = await res.json();

    if (json.errors) {
      this.logger.error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
      return { status: 'error' };
    }

    const contributionsCollection = json.data?.user?.contributionsCollection;
    if (!contributionsCollection) {
      this.logger.debug(`[${username}] No contributions data`);
      return { status: 'no_changes' };
    }

    // 커밋 기여 파싱
    const commitContributions: { occurredAt: string; commitCount: number; repo: string }[] = [];
    for (const repo of contributionsCollection.commitContributionsByRepository || []) {
      const repoName = `${repo.repository.owner.login}/${repo.repository.name}`;
      for (const node of repo.contributions.nodes || []) {
        commitContributions.push({
          occurredAt: node.occurredAt,
          commitCount: node.commitCount,
          repo: repoName,
        });
      }
    }

    // PR 기여 파싱
    const prContributions: { occurredAt: string }[] =
      contributionsCollection.pullRequestContributions?.nodes || [];

    // 최신 시간 찾기
    const allTimes = [
      ...commitContributions.map(c => c.occurredAt),
      ...prContributions.map(p => p.occurredAt),
    ].filter(Boolean);

    if (allTimes.length === 0) {
      this.logger.debug(`[${username}] No contributions found`);
      return { status: 'no_changes' };
    }

    const latestTime = allTimes.sort().reverse()[0];

    this.logger.log(
      `[${username}] GraphQL Response: ${commitContributions.length} commit contributions, ` +
        `${prContributions.length} PR contributions, Latest: ${latestTime}, ` +
        `lastProcessedAt: ${schedule.lastProcessedAt.toISOString()}`,
    );

    // 상위 3개 커밋 로깅
    const top3Commits = commitContributions
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 3);
    if (top3Commits.length > 0) {
      const top3Log = top3Commits.map(c => `${c.commitCount} commits on ${c.repo} @ ${c.occurredAt}`);
      this.logger.log(`[${username}] Top 3 commits:\n  - ${top3Log.join('\n  - ')}`);
    }

    // 새로운 기여 필터링
    const newCommits = commitContributions.filter(
      c => new Date(c.occurredAt) > schedule.lastProcessedAt
    );
    const newPRs = prContributions.filter(
      p => new Date(p.occurredAt) > schedule.lastProcessedAt
    );

    if (newCommits.length === 0 && newPRs.length === 0) {
      this.logger.debug(
        `[${username}] All contributions filtered out (older than lastProcessedAt)`,
      );
      return { status: 'no_changes' };
    }

    const pushCount = newCommits.reduce((sum, c) => sum + c.commitCount, 0);
    const prCount = newPRs.length;

    // lastProcessedAt을 최신 시간으로 갱신
    schedule.lastProcessedAt = new Date(latestTime);

    this.logger.log(
      `[${username}] New contributions detected! Commits: ${pushCount}, PR: ${prCount}`,
    );

    return {
      status: 'new_events',
      data: {
        username,
        pushCount,
        pullRequestCount: prCount,
      },
    };
  }
}
