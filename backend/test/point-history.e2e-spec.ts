import request from 'supertest';
import { Repository } from 'typeorm';

import { Player } from '../src/player/entites/player.entity';
import { DailyPoint } from '../src/point/entities/daily-point.entity';
import {
  PointHistory,
  PointType,
} from '../src/pointhistory/entities/point-history.entity';
import { Task } from '../src/task/entites/task.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
  seedAuthenticatedPlayer,
} from './e2e-test-helpers';

type PointResponse = {
  amount: number;
};

type PointRankResponse = {
  playerId: number;
  githubUsername?: string | null;
  totalPoints: number;
  rank: number;
};

type HistoryRankResponse = {
  playerId: number;
  githubUsername?: string | null;
  count: number;
  rank: number;
};

type GitHistoryResponse = {
  description: string;
};

describe('Point/History API E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let dailyPointRepository: Repository<DailyPoint>;
  let pointHistoryRepository: Repository<PointHistory>;
  let taskRepository: Repository<Task>;

  const getHttpServer = (): Parameters<typeof request>[0] =>
    context.app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    context = await createTestApp({
      includePointController: true,
      includePointHistoryController: true,
    });
    playerRepository = getRepository(context, Player);
    dailyPointRepository = getRepository(context, DailyPoint);
    pointHistoryRepository = getRepository(context, PointHistory);
    taskRepository = getRepository(context, Task);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await taskRepository.clear();
    await pointHistoryRepository.clear();
    await dailyPointRepository.clear();
    await playerRepository.clear();
  });

  it('포인트 조회는 대상 플레이어의 1년 내 daily points만 반환한다', async () => {
    // Given
    const viewer = await seedAuthenticatedPlayer(context, {
      socialId: 32001,
      username: 'point-viewer',
    });
    const target = await seedAuthenticatedPlayer(context, {
      socialId: 32002,
      username: 'point-target',
    });
    const other = await seedAuthenticatedPlayer(context, {
      socialId: 32003,
      username: 'point-other',
    });

    await dailyPointRepository.save([
      {
        player: target.player,
        amount: 10,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        player: target.player,
        amount: 99,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        player: other.player,
        amount: 77,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]);

    // When
    const response = await request(getHttpServer())
      .get(
        `/api/points?targetPlayerId=${target.player.id}&currentTime=${encodeURIComponent(
          '2026-03-17T00:00:00.000Z',
        )}`,
      )
      .set('Cookie', viewer.cookie)
      .expect(200);
    const body = response.body as PointResponse[];

    // Then
    expect(body).toHaveLength(1);
    expect(body[0].amount).toBe(10);
  });

  it('주간 랭킹과 활동 히스토리 랭킹을 반환한다', async () => {
    // Given
    const viewer = await seedAuthenticatedPlayer(context, {
      socialId: 32004,
      username: 'rank-viewer',
    });
    const first = await seedAuthenticatedPlayer(context, {
      socialId: 32005,
      username: 'rank-first',
    });
    const second = await seedAuthenticatedPlayer(context, {
      socialId: 32006,
      username: 'rank-second',
    });

    await dailyPointRepository.save([
      {
        player: first.player,
        amount: 20,
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        player: second.player,
        amount: 10,
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
      },
    ]);

    await pointHistoryRepository.save([
      {
        player: first.player,
        type: PointType.COMMITTED,
        amount: 2,
        repository: 'repo-a',
        description: 'commit-a',
        activityAt: new Date('2026-03-10T10:00:00.000Z'),
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      },
      {
        player: first.player,
        type: PointType.COMMITTED,
        amount: 2,
        repository: 'repo-a',
        description: 'commit-b',
        activityAt: new Date('2026-03-11T10:00:00.000Z'),
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
      },
      {
        player: second.player,
        type: PointType.COMMITTED,
        amount: 2,
        repository: 'repo-b',
        description: 'commit-c',
        activityAt: new Date('2026-03-12T10:00:00.000Z'),
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
      },
    ]);

    // When
    const pointRanks = await request(getHttpServer())
      .get(
        `/api/points/ranks?weekendStartAt=${encodeURIComponent(
          '2026-03-10T00:00:00.000Z',
        )}`,
      )
      .set('Cookie', viewer.cookie)
      .expect(200);
    const historyRanks = await request(getHttpServer())
      .get(
        `/api/history-ranks?weekendStartAt=${encodeURIComponent(
          '2026-03-10T00:00:00.000Z',
        )}&type=COMMITTED`,
      )
      .set('Cookie', viewer.cookie)
      .expect(200);
    const pointRanksBody = pointRanks.body as PointRankResponse[];
    const historyRanksBody = historyRanks.body as HistoryRankResponse[];

    // Then
    expect(pointRanksBody[0]).toMatchObject({
      playerId: first.player.id,
      githubUsername: 'rank-first',
      totalPoints: 20,
      rank: 1,
    });
    expect(historyRanksBody[0]).toMatchObject({
      playerId: first.player.id,
      githubUsername: 'rank-first',
      count: 2,
      rank: 1,
    });
  });

  it('TASK_COMPLETED 랭킹은 githubUsername 기준 식별자를 함께 반환한다', async () => {
    const viewer = await seedAuthenticatedPlayer(context, {
      socialId: 32010,
      username: 'task-rank-viewer',
    });
    const first = await seedAuthenticatedPlayer(context, {
      socialId: 32011,
      username: 'task-rank-first',
      nickname: 'Task First',
    });
    const second = await seedAuthenticatedPlayer(context, {
      socialId: 32012,
      username: 'task-rank-second',
      nickname: 'Task Second',
    });

    await taskRepository.save([
      {
        player: first.player,
        description: 'done-1',
        isCompleted: true,
        completedAt: new Date('2026-03-11T10:00:00.000Z'),
        createdAt: new Date('2026-03-11T09:00:00.000Z'),
      },
      {
        player: first.player,
        description: 'done-2',
        isCompleted: true,
        completedAt: new Date('2026-03-12T10:00:00.000Z'),
        createdAt: new Date('2026-03-12T09:00:00.000Z'),
      },
      {
        player: second.player,
        description: 'done-3',
        isCompleted: true,
        completedAt: new Date('2026-03-13T10:00:00.000Z'),
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
      },
    ]);

    const response = await request(getHttpServer())
      .get(
        `/api/history-ranks?weekendStartAt=${encodeURIComponent(
          '2026-03-10T00:00:00.000Z',
        )}&type=TASK_COMPLETED`,
      )
      .set('Cookie', viewer.cookie)
      .expect(200);
    const body = response.body as HistoryRankResponse[];

    expect(body[0]).toMatchObject({
      playerId: first.player.id,
      githubUsername: 'task-rank-first',
      count: 2,
      rank: 1,
    });
    expect(body[1]).toMatchObject({
      playerId: second.player.id,
      githubUsername: 'task-rank-second',
      count: 1,
      rank: 2,
    });
  });

  it('Git 이벤트 히스토리 조회는 날짜 범위 내 대상 플레이어 데이터만 반환한다', async () => {
    // Given
    const viewer = await seedAuthenticatedPlayer(context, {
      socialId: 32007,
      username: 'history-viewer',
    });
    const target = await seedAuthenticatedPlayer(context, {
      socialId: 32008,
      username: 'history-target',
    });
    const other = await seedAuthenticatedPlayer(context, {
      socialId: 32009,
      username: 'history-other',
    });

    await pointHistoryRepository.save([
      {
        player: target.player,
        type: PointType.PR_OPEN,
        amount: 2,
        repository: 'repo-target',
        description: 'in-range',
        activityAt: new Date('2026-03-10T10:00:00.000Z'),
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      },
      {
        player: target.player,
        type: PointType.PR_OPEN,
        amount: 2,
        repository: 'repo-target',
        description: 'out-of-range',
        activityAt: new Date('2026-03-25T10:00:00.000Z'),
        createdAt: new Date('2026-03-25T10:00:00.000Z'),
      },
      {
        player: other.player,
        type: PointType.PR_OPEN,
        amount: 2,
        repository: 'repo-other',
        description: 'other-player',
        activityAt: new Date('2026-03-10T10:00:00.000Z'),
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      },
    ]);

    // When
    const response = await request(getHttpServer())
      .get(
        `/api/git-histories?targetPlayerId=${target.player.id}&startAt=${encodeURIComponent(
          '2026-03-09T00:00:00.000Z',
        )}&endAt=${encodeURIComponent('2026-03-15T00:00:00.000Z')}`,
      )
      .set('Cookie', viewer.cookie)
      .expect(200);
    const body = response.body as GitHistoryResponse[];

    // Then
    expect(body).toHaveLength(1);
    expect(body[0].description).toBe('in-range');
  });
});
