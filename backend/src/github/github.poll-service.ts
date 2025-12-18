import { Injectable, Logger } from '@nestjs/common';
import { GithubGateway } from './github.gateway';

interface PollingSchedule {
  interval: NodeJS.Timeout;
  lastProcessedAt: Date;
  username: string;
  accessToken: string;
}

interface GithubEvent {
  type: string;
  created_at: string;
}

@Injectable()
export class GithubPollService {
  private readonly logger = new Logger(GithubPollService.name);

  constructor(private readonly githubGateway: GithubGateway) {}

  private readonly pollingSchedules = new Map<string, PollingSchedule>();
  private readonly etagMap = new Map<string, string>(); // username -> etag

  subscribeGithubEvent(
    connectedAt: Date,
    clientId: string,
    roomId: string,
    username: string,
    accessToken: string,
  ) {
    if (this.pollingSchedules.has(clientId)) return;

    const interval = setInterval(() => {
      void this.handlePoll(clientId, roomId);
    }, 30_000);

    this.pollingSchedules.set(clientId, {
      interval,
      lastProcessedAt: connectedAt,
      username,
      accessToken,
    });

    this.logger.log(`GitHub polling started for user: ${username}`);
  }

  unsubscribeGithubEvent(clientId: string) {
    const schedule = this.pollingSchedules.get(clientId);
    if (!schedule) return;

    clearInterval(schedule.interval);
    this.pollingSchedules.delete(clientId);
    // etagMap은 username 기준이므로 재접속 시 ETag 재사용 위해 유지
  }

  private async handlePoll(clientId: string, roomId: string) {
    const githubEvent = await this.pollGithubEvents(clientId);
    if (githubEvent) {
      this.githubGateway.castGithubEventToRoom(githubEvent, roomId);
    }
  }

  private async pollGithubEvents(clientId: string) {
    const schedule = this.pollingSchedules.get(clientId);
    if (!schedule) return;

    const { username, accessToken } = schedule;
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
      return;
    }

    if (!res.ok) return;

    // ETag 저장
    const newETag = res.headers.get('ETag');
    if (newETag) {
      this.etagMap.set(username, newETag);
    }

    const events = (await res.json()) as GithubEvent[];
    if (events.length === 0) return;

    const newEvents = events.filter(
      (event) => new Date(event.created_at) > schedule.lastProcessedAt,
    );

    const pushCount = newEvents.filter((e) => e.type === 'PushEvent').length;
    const prCount = newEvents.filter(
      (e) => e.type === 'PullRequestEvent',
    ).length;

    schedule.lastProcessedAt = new Date(events[0].created_at);

    return {
      clientId,
      pushCount,
      pullRequestCount: prCount,
    };
  }
}
