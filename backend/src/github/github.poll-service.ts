import { Injectable, Logger } from '@nestjs/common';
import { GithubGateway } from './github.gateway';

// 폴링 간격 설정 (밀리초)
const POLL_INTERVAL = 30_000; // 30초마다 폴링
const POLL_INTERVAL_BACKOFF = 120_000; // 429 응답 시 (rate limit)

interface PollingSchedule {
  timeout: NodeJS.Timeout;
  username: string;
  accessToken: string;
  roomId: string;
  clientIds: Set<string>; // 같은 유저의 여러 클라이언트 추적
  // 커밋 수 기반 추적 (GraphQL API는 날짜별 집계라 시간 비교 불가)
  lastCommitCounts: Map<string, number>; // repo -> commitCount
  lastPRCount: number;
  isFirstPoll: boolean; // 첫 폴링은 알림 안 보냄 (기준점 설정용)
}

// GraphQL 응답 타입
interface GraphQLResponse {
  errors?: Array<{ message: string }>;
  data?: {
    user?: {
      contributionsCollection?: ContributionsCollection;
    };
  };
}

interface ContributionsCollection {
  commitContributionsByRepository?: Array<{
    repository: {
      owner: { login: string };
      name: string;
    };
    contributions: {
      nodes?: Array<{ commitCount: number }>;
    };
  }>;
  pullRequestContributions?: {
    nodes?: Array<unknown>;
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

    this.pollingSchedules.set(username, {
      timeout,
      username,
      accessToken,
      roomId,
      clientIds: new Set([clientId]),
      lastCommitCounts: new Map(),
      lastPRCount: 0,
      isFirstPoll: true, // 첫 폴링은 기준점 설정용
    });

    this.logger.log(`GitHub polling started for user: ${username}`);
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

    const json = (await res.json()) as GraphQLResponse;

    if (json.errors) {
      this.logger.error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
      return { status: 'error' };
    }

    const contributionsCollection = json.data?.user?.contributionsCollection;
    if (!contributionsCollection) {
      this.logger.debug(`[${username}] No contributions data`);
      return { status: 'no_changes' };
    }

    // 커밋 기여 파싱 - 리포지토리별 총 커밋 수 계산
    const currentCommitCounts = new Map<string, number>();
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
    const currentPRCount =
      contributionsCollection.pullRequestContributions?.nodes?.length || 0;

    this.logger.log(
      `[${username}] GraphQL Response: ${currentCommitCounts.size} repos, ` +
        `total commits: ${[...currentCommitCounts.values()].reduce((a, b) => a + b, 0)}, ` +
        `PRs: ${currentPRCount}, isFirstPoll: ${schedule.isFirstPoll}`,
    );

    // 상위 3개 리포지토리 로깅
    const sortedRepos = [...currentCommitCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (sortedRepos.length > 0) {
      const top3Log = sortedRepos.map(([repo, count]) => {
        const prevCount = schedule.lastCommitCounts.get(repo) || 0;
        const diff = count - prevCount;
        return `${repo}: ${count} commits (${diff >= 0 ? '+' : ''}${diff})`;
      });
      this.logger.log(
        `[${username}] Top repos:\n  - ${top3Log.join('\n  - ')}`,
      );
    }

    // 첫 폴링이면 기준점만 설정하고 알림 안 보냄
    if (schedule.isFirstPoll) {
      schedule.lastCommitCounts = currentCommitCounts;
      schedule.lastPRCount = currentPRCount;
      schedule.isFirstPoll = false;
      this.logger.log(
        `[${username}] First poll - baseline set, no notification`,
      );
      return { status: 'no_changes' };
    }

    // 새로운 커밋 수 계산 (커밋 수 증가분)
    let newCommitCount = 0;
    for (const [repo, count] of currentCommitCounts) {
      const prevCount = schedule.lastCommitCounts.get(repo) || 0;
      if (count > prevCount) {
        newCommitCount += count - prevCount;
      }
    }

    // 새로운 PR 수 계산
    const newPRCount = Math.max(0, currentPRCount - schedule.lastPRCount);

    // 기준점 갱신
    schedule.lastCommitCounts = currentCommitCounts;
    schedule.lastPRCount = currentPRCount;

    if (newCommitCount === 0 && newPRCount === 0) {
      this.logger.debug(`[${username}] No new contributions`);
      return { status: 'no_changes' };
    }

    this.logger.log(
      `[${username}] New contributions detected! Commits: +${newCommitCount}, PRs: +${newPRCount}`,
    );

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
