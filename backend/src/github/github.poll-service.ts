import { Injectable } from '@nestjs/common';
import { GithubGateway } from './github.gateway';

interface PollingSchedule {
  interval: NodeJS.Timeout;
  lastProcessedAt: Date;
}

interface GithubEvent {
  type: string;
  created_at: string;
}

@Injectable()
export class GithubPollService {
  constructor(private readonly githubGateway: GithubGateway) {}

  private readonly testUsers = ['songhaechan'];
  private readonly pollingSchedules = new Map<string, PollingSchedule>();

  subscribeGithubEvent(connectedAt: Date, clientId: string, roomId: string) {
    if (this.pollingSchedules.has(clientId)) return;

    const interval = setInterval(() => {
      void this.handlePoll(clientId, roomId);
    }, 60_000);

    this.pollingSchedules.set(clientId, {
      interval,
      lastProcessedAt: connectedAt,
    });
  }

  unsubscribeGithubEvent(clientId: string) {
    const schedule = this.pollingSchedules.get(clientId);
    if (!schedule) return;

    clearInterval(schedule.interval);
    this.pollingSchedules.delete(clientId);
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

    const username = this.testUsers[0];
    const url = `https://api.github.com/users/${username}/events`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) return;

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
