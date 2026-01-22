import { Injectable, Logger } from '@nestjs/common';
import { GithubGateway } from './github.gateway';
import { GithubService } from './github.service';
import { GithubActivityType } from './entities/daily-github-activity.entity';

// 폴링 간격 설정 (밀리초)
const POLL_INTERVAL = 30_000; // 30초마다 폴링
const POLL_INTERVAL_BACKOFF = 120_000; // 429 응답 시 (rate limit)

interface PollingSchedule {
  timeout: NodeJS.Timeout;
  username: string;
  accessToken: string;
  roomId: string;
  clientIds: Set<string>; // 같은 유저의 여러 클라이언트 추적
  playerId: number;
}

// 기준점 저장 (새로고침해도 유지)
interface UserBaseline {
  lastCommitCount: number;
  lastPRCount: number;
  lastIssueCount: number;
  lastPRReviewCount: number;
  isFirstPoll: boolean;
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
  totalCommitContributions?: number;
  totalIssueContributions?: number;
  totalPullRequestContributions?: number;
  totalPullRequestReviewContributions?: number;
}

@Injectable()
export class GithubPollService {
  private readonly logger = new Logger(GithubPollService.name);

  constructor(
    private readonly githubGateway: GithubGateway,
    private readonly githubService: GithubService,
  ) {}

  // username -> PollingSchedule (username 기준으로 중복 방지)
  private readonly pollingSchedules = new Map<string, PollingSchedule>();

  // username -> 기준점 (새로고침해도 유지)
  private readonly userBaselines = new Map<string, UserBaseline>();

  subscribeGithubEvent(
    connectedAt: Date,
    clientId: string,
    roomId: string,
    username: string,
    accessToken: string,
    playerId: number,
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
      playerId,
    });

    // 기준점이 없으면 새로 생성 (있으면 유지 - 새로고침 시 복원)
    const hasBaseline = this.userBaselines.has(username);
    if (!hasBaseline) {
      this.userBaselines.set(username, {
        lastCommitCount: 0,
        lastPRCount: 0,
        lastIssueCount: 0,
        lastPRReviewCount: 0,
        isFirstPoll: true,
      });
    }

    this.logger.log(
      `GitHub polling started for user: ${username} (baseline: ${hasBaseline ? 'restored' : 'new'})`,
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

    const baseline = this.userBaselines.get(username);
    if (!baseline) return { status: 'error' };

    const { accessToken } = schedule;

    // GraphQL API 사용 (REST API 캐시 문제 우회)
    const query = `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            totalCommitContributions
            totalIssueContributions
            totalPullRequestContributions
            totalPullRequestReviewContributions
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

    // 커밋 기여 파싱 - 총 개수
    const currentCommitCount =
      contributionsCollection.totalCommitContributions ?? 0;

    // PR 기여 파싱 - 총 개수 (total 필드 사용)
    const currentPRCount =
      contributionsCollection.totalPullRequestContributions ?? 0;

    // 이슈 기여 파싱 - 총 개수
    const currentIssueCount =
      contributionsCollection.totalIssueContributions ?? 0;

    // PR 리뷰 기여 파싱 - 총 개수
    const currentPRReviewCount =
      contributionsCollection.totalPullRequestReviewContributions ?? 0;

    const { isFirstPoll } = baseline;

    this.logger.log(
      `[${username}] GraphQL Response: ` +
        `Commits: ${currentCommitCount}, PRs: ${currentPRCount}, ` +
        `Issues: ${currentIssueCount}, Reviews: ${currentPRReviewCount}, isFirstPoll: ${isFirstPoll}`,
    );

    // 첫 폴링이면 기준점만 설정하고 알림 안 보냄
    if (isFirstPoll) {
      baseline.lastCommitCount = currentCommitCount;
      baseline.lastPRCount = currentPRCount;
      baseline.lastIssueCount = currentIssueCount;
      baseline.lastPRReviewCount = currentPRReviewCount;
      baseline.isFirstPoll = false;
      this.logger.log(
        `[${username}] First poll - baseline set, no notification`,
      );
      return { status: 'no_changes' };
    }

    // 새로운 커밋 수 계산
    const newCommitCount = Math.max(
      0,
      currentCommitCount - baseline.lastCommitCount,
    );

    // 새로운 PR 수 계산
    const newPRCount = Math.max(0, currentPRCount - baseline.lastPRCount);

    // 새로운 이슈 수 계산
    const newIssueCount = Math.max(
      0,
      currentIssueCount - baseline.lastIssueCount,
    );

    // 새로운 PR 리뷰 수 계산
    const newPRReviewCount = Math.max(
      0,
      currentPRReviewCount - baseline.lastPRReviewCount,
    );

    // 기준점 갱신
    baseline.lastCommitCount = currentCommitCount;
    baseline.lastPRCount = currentPRCount;
    baseline.lastIssueCount = currentIssueCount;
    baseline.lastPRReviewCount = currentPRReviewCount;

    if (
      newCommitCount === 0 &&
      newPRCount === 0 &&
      newIssueCount === 0 &&
      newPRReviewCount === 0
    ) {
      this.logger.debug(`[${username}] No new contributions`);
      return { status: 'no_changes' };
    }

    // DB에 새 이벤트 누적
    const { playerId } = schedule;
    if (newIssueCount > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.ISSUE_OPEN,
        newIssueCount,
      );
    }
    if (newPRCount > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.PR_OPEN,
        newPRCount,
      );
    }
    if (newPRReviewCount > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.PR_REVIEWED,
        newPRReviewCount,
      );
    }
    if (newCommitCount > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.COMMITTED,
        newCommitCount,
      );
    }

    this.logger.log(
      `[${username}] New contributions detected! Commits: +${newCommitCount}, PRs: +${newPRCount}, Issues: +${newIssueCount}, Reviews: +${newPRReviewCount}`,
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
