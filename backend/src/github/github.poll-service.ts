import { Injectable, Logger } from '@nestjs/common';
import { GithubGateway } from './github.gateway';

// 폴링 간격 설정 (밀리초)
const POLL_INTERVAL_FAST = 10_000; // 304 응답 시 (변경 없음)
const POLL_INTERVAL_SLOW = 60_000; // 200 응답 시 (새 데이터)
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
}

@Injectable()
export class GithubPollService {
  private readonly logger = new Logger(GithubPollService.name);

  constructor(private readonly githubGateway: GithubGateway) {}

  // username -> PollingSchedule (username 기준으로 중복 방지)
  private readonly pollingSchedules = new Map<string, PollingSchedule>();
  private readonly etagMap = new Map<string, string>(); // username -> etag

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

    // 첫 폴링은 빠르게 시작
    const timeout = setTimeout(() => {
      void this.handlePoll(username);
    }, POLL_INTERVAL_FAST);

    this.pollingSchedules.set(username, {
      timeout,
      lastProcessedAt: connectedAt,
      username,
      accessToken,
      roomId,
      clientIds: new Set([clientId]),
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
        nextInterval = POLL_INTERVAL_SLOW; // 새 데이터 → 60초 대기
        this.githubGateway.castGithubEventToRoom(result.data!, schedule.roomId);
        break;
      case 'no_changes':
        nextInterval = POLL_INTERVAL_FAST; // 변경 없음 → 10초 후 재시도
        break;
      case 'rate_limited':
        nextInterval = result.retryAfter || POLL_INTERVAL_BACKOFF; // 429 → 백오프
        this.logger.warn(
          `Rate limited for user: ${schedule.username}, retry after ${nextInterval}ms`,
        );
        break;
      case 'error':
      default:
        nextInterval = POLL_INTERVAL_SLOW; // 에러 → 60초 후 재시도
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
    const url = `https://api.github.com/users/${username}/events`;
    const lastETag = this.etagMap.get(username);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
    };

    if (lastETag) {
      headers['If-None-Match'] = lastETag;
    }

    const res = await fetch(url, { headers });

    this.logger.log('[GitHub Poll]', {
      url,
      status: res.status,
      etag: res.headers.get('ETag'),
      rateLimit: {
        limit: res.headers.get('X-RateLimit-Limit'),
        remaining: res.headers.get('X-RateLimit-Remaining'),
        used: res.headers.get('X-RateLimit-Used'),
      },
    });

    // 304 Not Modified - 변경 없음, rate limit 미차감
    if (res.status === 304) {
      this.logger.debug(`No changes for user: ${username}`);
      return { status: 'no_changes' };
    }

    // 429 Too Many Requests - rate limit 초과
    if (res.status === 429) {
      const resetHeader = res.headers.get('X-RateLimit-Reset');
      let retryAfter = POLL_INTERVAL_BACKOFF;

      if (resetHeader) {
        const resetTime = parseInt(resetHeader, 10) * 1000; // Unix timestamp → ms
        retryAfter = Math.max(resetTime - Date.now(), POLL_INTERVAL_BACKOFF);
      }

      return { status: 'rate_limited', retryAfter };
    }

    if (!res.ok) {
      this.logger.error(`GitHub API error: ${res.status} ${res.statusText}`);
      return { status: 'error' };
    }

    // ETag 저장
    const newETag = res.headers.get('ETag');
    if (newETag) {
      this.etagMap.set(username, newETag);
    }

    const events = (await res.json()) as GithubEvent[];
    if (events.length === 0) return { status: 'no_changes' };

    const newEvents = events.filter(
      (event) => new Date(event.created_at) > schedule.lastProcessedAt,
    );

    if (newEvents.length === 0) return { status: 'no_changes' };

    const pushCount = newEvents.filter((e) => e.type === 'PushEvent').length;
    const prCount = newEvents.filter(
      (e) => e.type === 'PullRequestEvent',
    ).length;

    schedule.lastProcessedAt = new Date(events[0].created_at);

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
