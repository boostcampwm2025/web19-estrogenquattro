import { Injectable, Logger } from '@nestjs/common';
import { ProgressGateway, ProgressSource } from './progress.gateway';
import { GithubService } from './github.service';
import { GithubActivityType } from './entities/daily-github-activity.entity';
import { PointService } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';

// 폴링 간격 설정 (밀리초)
const POLL_INTERVAL = 120_000; // 120초마다 폴링 (REST API 이벤트 갱신 지연 고려)
const POLL_INTERVAL_BACKOFF = 600_000; // 10분 (rate limit 시)

// 첫 폴링에서 이벤트가 없을 때 사용하는 sentinel 값
const NO_EVENTS_SENTINEL = '-1';

interface PollingSchedule {
  timeout: NodeJS.Timeout;
  username: string;
  accessToken: string;
  roomId: string;
  clientIds: Set<string>;
  playerId: number;
  etag: string | null; // ETag 저장
  lastEventId: string | null; // 마지막 이벤트 ID
}

// REST API 이벤트 타입
interface GithubEvent {
  id: string;
  type: string;
  actor: {
    id: number;
    login: string;
  };
  repo: {
    id: number;
    name: string; // "owner/repo" 형식
  };
  payload: object;
  created_at: string;
}

// 이벤트 Payload 타입들
interface PullRequestEventPayload {
  action: 'opened' | 'closed' | 'merged' | 'reopened';
  number: number;
  pull_request: {
    id: number;
    number: number;
    url: string;
    merged?: boolean;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
  };
}

interface IssuesEventPayload {
  action: 'opened' | 'closed' | 'reopened';
  issue: {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
  };
}

interface PullRequestReviewEventPayload {
  action: 'created' | 'edited' | 'dismissed';
  pull_request: {
    id: number;
    number: number;
  };
  review: {
    id: number;
    state: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  };
}

interface PushEventPayload {
  repository_id: number;
  push_id: number;
  ref: string;
  head: string;
  before: string;
}

interface CompareResponse {
  total_commits: number;
  commits: Array<{
    sha: string;
    commit: {
      message: string;
    };
  }>;
}

interface PrResponse {
  number: number;
  title: string;
  state: string;
  merged: boolean;
}

// 타입 가드 함수 (export for testing)
export function isGithubEventArray(data: unknown): data is GithubEvent[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'type' in item,
    )
  );
}

export function isCompareResponse(data: unknown): data is CompareResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'total_commits' in data &&
    typeof (data as CompareResponse).total_commits === 'number' &&
    'commits' in data &&
    Array.isArray((data as CompareResponse).commits)
  );
}

export function isPrResponse(data: unknown): data is PrResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'number' in data &&
    'title' in data &&
    typeof (data as PrResponse).title === 'string'
  );
}

@Injectable()
export class GithubPollService {
  private readonly logger = new Logger(GithubPollService.name);

  constructor(
    private readonly progressGateway: ProgressGateway,
    private readonly githubService: GithubService,
    private readonly pointService: PointService,
  ) {}

  // username -> PollingSchedule (username 기준으로 중복 방지)
  private readonly pollingSchedules = new Map<string, PollingSchedule>();

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
      this.logger.debug(
        `Client ${clientId} joined existing poll for ${username}`,
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
      etag: null,
      lastEventId: null,
    });

    this.logger.debug(`GitHub polling started for ${username}`);
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
          this.logger.debug(`GitHub polling stopped for ${username}`);
        } else {
          this.logger.debug(
            `Client ${clientId} left poll for ${username} (${schedule.clientIds.size} remaining)`,
          );
        }
        return;
      }
    }
  }

  private stopPolling(username: string) {
    const schedule = this.pollingSchedules.get(username);
    if (schedule) {
      clearTimeout(schedule.timeout);
      this.pollingSchedules.delete(username);
      this.logger.debug(`GitHub polling stopped for ${username}`);
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

    // 폴링 중지된 경우 (401 토큰 만료)
    if (result.status === 'stopped') {
      return;
    }

    // 다음 폴링 간격 결정
    let nextInterval: number;
    switch (result.status) {
      case 'new_events':
        nextInterval = POLL_INTERVAL;
        this.progressGateway.castProgressUpdate(
          result.data!.username,
          ProgressSource.GITHUB,
          result.data!,
        );
        break;
      case 'first_poll':
      case 'no_changes':
        nextInterval = POLL_INTERVAL;
        break;
      case 'rate_limited':
        nextInterval = POLL_INTERVAL_BACKOFF;
        this.logger.warn(
          `Rate limited for user: ${schedule.username}, retry after ${nextInterval / 1000}s`,
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
    status:
      | 'new_events'
      | 'first_poll'
      | 'no_changes'
      | 'rate_limited'
      | 'stopped'
      | 'error';
    data?: {
      username: string;
      commitCount: number;
      prCount: number;
      issueCount: number;
      reviewCount: number;
    };
  }> {
    const schedule = this.pollingSchedules.get(username);
    if (!schedule) return { status: 'error' };

    const { accessToken } = schedule;

    // REST API 호출 (최근 100개 조회)
    const url = `https://api.github.com/users/${username}/events/public?per_page=100`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // ETag 있으면 조건부 요청
    if (schedule.etag) {
      headers['If-None-Match'] = schedule.etag;
    }

    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch (error) {
      this.logger.error(
        `[${username}] GitHub API network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { status: 'error' };
    }

    this.logger.debug(
      `[${username}] HTTP ${res.status}, remaining: ${res.headers.get('X-RateLimit-Remaining')}`,
    );

    // 401: 토큰 만료 또는 무효 → 폴링 중지
    if (res.status === 401) {
      this.logger.error(`[${username}] Token expired or invalid`);
      this.stopPolling(username);
      return { status: 'stopped' };
    }

    // 403/429: Rate Limit → 10분 대기
    if (res.status === 403 || res.status === 429) {
      this.logger.warn(`[${username}] Rate limit, waiting 10 minutes`);
      return { status: 'rate_limited' };
    }

    // 304: 변화 없음 (Rate Limit 소모 안 함)
    if (res.status === 304) {
      this.logger.debug(`[${username}] No changes (304)`);
      return { status: 'no_changes' };
    }

    if (!res.ok) {
      this.logger.error(`GitHub API error: ${res.status} ${res.statusText}`);
      return { status: 'error' };
    }

    // ETag 저장
    const newEtag = res.headers.get('ETag');
    if (newEtag) {
      schedule.etag = newEtag;
    }

    const eventsData: unknown = await res.json();

    if (!isGithubEventArray(eventsData)) {
      this.logger.error(`[${username}] Invalid events response format`);
      return { status: 'error' };
    }

    const events = eventsData;

    // 첫 폴링: lastEventId 설정, 브로드캐스트 안 함
    if (!schedule.lastEventId) {
      schedule.lastEventId = events[0]?.id ?? NO_EVENTS_SENTINEL;
      this.logger.debug(`[${username}] First poll - baseline set`);
      return { status: 'first_poll' };
    }

    // 이후 폴링: lastEventId 위치 기반으로 새 이벤트 필터링
    // GitHub 이벤트 ID는 시간순이 아니므로 findIndex 사용
    let newEvents: GithubEvent[];
    if (schedule.lastEventId === NO_EVENTS_SENTINEL) {
      newEvents = events;
    } else {
      const lastIndex = events.findIndex((e) => e.id === schedule.lastEventId);

      if (lastIndex === -1) {
        newEvents = events;
      } else if (lastIndex === 0) {
        newEvents = [];
      } else {
        newEvents = events.slice(0, lastIndex);
      }
    }

    if (newEvents.length > 0) {
      schedule.lastEventId = events[0].id; // 최신 이벤트 ID로 업데이트
    }

    if (newEvents.length === 0) {
      this.logger.debug(`[${username}] No new events`);
      return { status: 'no_changes' };
    }

    // [DEBUG] 이벤트 분석용 raw JSON 로깅
    this.logger.log(`[${username}] New events (${newEvents.length}):`);
    for (const event of newEvents) {
      this.logger.log(
        `[${username}] RAW EVENT: ${JSON.stringify(event, null, 2)}`,
      );
    }

    // 이벤트 처리
    const details = await this.processEvents(newEvents, schedule);

    const totalEvents =
      details.commits.length +
      details.prOpens.length +
      details.prMerges.length +
      details.issues.length +
      details.reviews.length;

    if (totalEvents === 0) {
      return { status: 'no_changes' };
    }

    // DB에 새 이벤트 누적 및 포인트 적립
    const { playerId } = schedule;

    // 커밋
    if (details.commits.length > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.COMMITTED,
        details.commits.length,
      );
      for (const commit of details.commits) {
        await this.pointService.addPoint(
          playerId,
          PointType.COMMITTED,
          1,
          commit.repository,
          commit.message,
        );
      }
    }

    // PR 생성
    if (details.prOpens.length > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.PR_OPEN,
        details.prOpens.length,
      );
      for (const pr of details.prOpens) {
        await this.pointService.addPoint(
          playerId,
          PointType.PR_OPEN,
          1,
          pr.repository,
          pr.title,
        );
      }
    }

    // PR 머지
    if (details.prMerges.length > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.PR_MERGED,
        details.prMerges.length,
      );
      for (const pr of details.prMerges) {
        await this.pointService.addPoint(
          playerId,
          PointType.PR_MERGED,
          1,
          pr.repository,
          pr.title,
        );
      }
    }

    // 이슈 생성
    if (details.issues.length > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.ISSUE_OPEN,
        details.issues.length,
      );
      for (const issue of details.issues) {
        await this.pointService.addPoint(
          playerId,
          PointType.ISSUE_OPEN,
          1,
          issue.repository,
          issue.title,
        );
      }
    }

    // PR 리뷰
    if (details.reviews.length > 0) {
      await this.githubService.incrementActivity(
        playerId,
        GithubActivityType.PR_REVIEWED,
        details.reviews.length,
      );
      for (const review of details.reviews) {
        await this.pointService.addPoint(
          playerId,
          PointType.PR_REVIEWED,
          1,
          review.repository,
          review.prTitle,
        );
      }
    }

    this.logger.log(
      `[${username}] Commits: +${details.commits.length}, PRs: +${details.prOpens.length}, ` +
        `Merged: +${details.prMerges.length}, Issues: +${details.issues.length}, Reviews: +${details.reviews.length}`,
    );

    return {
      status: 'new_events',
      data: {
        username,
        commitCount: details.commits.length,
        prCount: details.prOpens.length + details.prMerges.length,
        issueCount: details.issues.length,
        reviewCount: details.reviews.length,
      },
    };
  }

  private async processEvents(
    events: GithubEvent[],
    schedule: PollingSchedule,
  ): Promise<{
    commits: Array<{ repository: string; message: string }>;
    prOpens: Array<{ repository: string; title: string }>;
    prMerges: Array<{ repository: string; title: string }>;
    issues: Array<{ repository: string; title: string }>;
    reviews: Array<{ repository: string; prTitle: string }>;
  }> {
    const commits: Array<{ repository: string; message: string }> = [];
    const prOpens: Array<{ repository: string; title: string }> = [];
    const prMerges: Array<{ repository: string; title: string }> = [];
    const issues: Array<{ repository: string; title: string }> = [];
    const reviews: Array<{ repository: string; prTitle: string }> = [];

    for (const event of events) {
      const repoName = event.repo.name;

      switch (event.type) {
        case 'PushEvent': {
          const pushPayload = event.payload as PushEventPayload;

          // Compare API로 실제 커밋 정보 조회
          const commitDetails = await this.getCommitDetails(
            repoName,
            pushPayload.before,
            pushPayload.head,
            schedule.accessToken,
          );

          for (const msg of commitDetails.messages) {
            commits.push({ repository: repoName, message: msg });
            this.logger.debug(
              `[${schedule.username}] COMMIT: "${msg}" (${repoName})`,
            );
          }
          break;
        }

        case 'PullRequestEvent': {
          const prPayload = event.payload as PullRequestEventPayload;
          const prNumber = prPayload.number;

          if (prPayload.action === 'opened') {
            const prTitle = await this.getPrTitle(
              repoName,
              prNumber,
              schedule.accessToken,
            );
            prOpens.push({ repository: repoName, title: prTitle });
            this.logger.debug(
              `[${schedule.username}] PR OPENED: "${prTitle}" #${prNumber} (${repoName})`,
            );
          } else if (
            prPayload.action === 'merged' ||
            (prPayload.action === 'closed' &&
              prPayload.pull_request?.merged === true)
          ) {
            const prTitle = await this.getPrTitle(
              repoName,
              prNumber,
              schedule.accessToken,
            );
            prMerges.push({ repository: repoName, title: prTitle });
            this.logger.debug(
              `[${schedule.username}] PR MERGED: "${prTitle}" #${prNumber} (${repoName})`,
            );
          }
          break;
        }

        case 'IssuesEvent': {
          const issuePayload = event.payload as IssuesEventPayload;
          if (issuePayload.action === 'opened') {
            issues.push({
              repository: repoName,
              title: issuePayload.issue.title,
            });
            this.logger.debug(
              `[${schedule.username}] ISSUE OPENED: "${issuePayload.issue.title}" (${repoName})`,
            );
          }
          break;
        }

        case 'PullRequestReviewEvent': {
          const reviewPayload = event.payload as PullRequestReviewEventPayload;
          if (reviewPayload.action === 'created') {
            const prTitle = await this.getPrTitle(
              repoName,
              reviewPayload.pull_request.number,
              schedule.accessToken,
            );
            reviews.push({ repository: repoName, prTitle });
            this.logger.debug(
              `[${schedule.username}] PR REVIEW: "${prTitle}" (${repoName})`,
            );
          }
          break;
        }
      }
    }

    return { commits, prOpens, prMerges, issues, reviews };
  }

  /**
   * Compare API로 실제 커밋 정보 조회
   * PushEvent 1개에 여러 커밋이 포함될 수 있으므로 Compare API로 정확한 개수와 메시지 확인
   */
  private async getCommitDetails(
    repoName: string,
    before: string,
    head: string,
    accessToken: string,
  ): Promise<{ count: number; messages: string[] }> {
    const url = `https://api.github.com/repos/${repoName}/compare/${before}...${head}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        // Compare API 실패 시 fallback
        return { count: 1, messages: ['(unknown)'] };
      }

      const data: unknown = await res.json();

      if (!isCompareResponse(data)) {
        return { count: 1, messages: ['(unknown)'] };
      }

      // 커밋 메시지 추출 (첫 줄만)
      const messages = data.commits.map((c) => c.commit.message.split('\n')[0]);

      return { count: data.total_commits, messages };
    } catch {
      // 네트워크 에러 시 fallback
      return { count: 1, messages: ['(unknown)'] };
    }
  }

  /**
   * PR API로 PR 제목 조회
   */
  private async getPrTitle(
    repoName: string,
    prNumber: number,
    accessToken: string,
  ): Promise<string> {
    const url = `https://api.github.com/repos/${repoName}/pulls/${prNumber}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        return `#${prNumber}`;
      }

      const data: unknown = await res.json();

      if (!isPrResponse(data)) {
        return `#${prNumber}`;
      }

      return data.title;
    } catch {
      return `#${prNumber}`;
    }
  }
}
