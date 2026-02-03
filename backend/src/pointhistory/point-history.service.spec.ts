import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PointHistoryService } from './point-history.service';
import { PointHistory, PointType } from './entities/point-history.entity';
import { Player } from '../player/entites/player.entity';
import { Pet } from '../userpet/entities/pet.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { FocusTimeService } from '../focustime/focustime.service';
import {
  DailyFocusTime,
  FocusStatus,
} from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { DatabaseModule } from '../database/database.module';

describe('PointHistoryService', () => {
  let service: PointHistoryService;
  let pointHistoryRepository: Repository<PointHistory>;
  let playerRepository: Repository<Player>;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let module: TestingModule;

  let player1: Player;
  let player2: Player;
  let player3: Player;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [PointHistory, Player, Pet, UserPet, DailyFocusTime, Task],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([PointHistory, Player, DailyFocusTime, Task]),
        DatabaseModule,
      ],
      providers: [PointHistoryService, FocusTimeService],
    }).compile();

    service = module.get<PointHistoryService>(PointHistoryService);
    pointHistoryRepository = module.get<Repository<PointHistory>>(
      getRepositoryToken(PointHistory),
    );
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
    focusTimeRepository = module.get<Repository<DailyFocusTime>>(
      getRepositoryToken(DailyFocusTime),
    );
  }, 30000);

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await pointHistoryRepository.clear();
    await focusTimeRepository.clear();
    await playerRepository.clear();

    // 테스트용 플레이어 생성
    player1 = await playerRepository.save(
      playerRepository.create({
        socialId: 1001,
        nickname: 'Player1',
        totalPoint: 0,
      }),
    );

    player2 = await playerRepository.save(
      playerRepository.create({
        socialId: 1002,
        nickname: 'Player2',
        totalPoint: 0,
      }),
    );

    player3 = await playerRepository.save(
      playerRepository.create({
        socialId: 1003,
        nickname: 'Player3',
        totalPoint: 0,
      }),
    );
  });

  const createHistory = async (
    player: Player,
    type: PointType,
    createdAt: Date,
  ): Promise<PointHistory> => {
    const history = pointHistoryRepository.create({
      player,
      type,
      amount: 2,
      createdAt,
    });
    return pointHistoryRepository.save(history);
  };

  describe('getHistoryRanks', () => {
    it('플레이어별 해당 타입 레코드 개수로 랭킹을 조회한다', async () => {
      // Given: weekendStartAt 기준 1주일 내 데이터
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');

      // Player1: 3개의 COMMITTED
      await createHistory(player1, PointType.COMMITTED, inRangeDate);
      await createHistory(player1, PointType.COMMITTED, inRangeDate);
      await createHistory(player1, PointType.COMMITTED, inRangeDate);

      // Player2: 2개의 COMMITTED
      await createHistory(player2, PointType.COMMITTED, inRangeDate);
      await createHistory(player2, PointType.COMMITTED, inRangeDate);

      // Player3: 1개의 COMMITTED
      await createHistory(player3, PointType.COMMITTED, inRangeDate);

      // When
      const result = await service.getHistoryRanks(
        PointType.COMMITTED,
        weekendStartAt,
      );

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].nickname).toBe('Player1');
      expect(result[0].count).toBe(3);
      expect(result[0].rank).toBe(1);

      expect(result[1].nickname).toBe('Player2');
      expect(result[1].count).toBe(2);
      expect(result[1].rank).toBe(2);

      expect(result[2].nickname).toBe('Player3');
      expect(result[2].count).toBe(1);
      expect(result[2].rank).toBe(3);
    });

    it('동점자는 같은 등수를 갖는다', async () => {
      // Given
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');

      // Player1: 3개
      await createHistory(player1, PointType.COMMITTED, inRangeDate);
      await createHistory(player1, PointType.COMMITTED, inRangeDate);
      await createHistory(player1, PointType.COMMITTED, inRangeDate);

      // Player2: 3개 (동점)
      await createHistory(player2, PointType.COMMITTED, inRangeDate);
      await createHistory(player2, PointType.COMMITTED, inRangeDate);
      await createHistory(player2, PointType.COMMITTED, inRangeDate);

      // Player3: 1개
      await createHistory(player3, PointType.COMMITTED, inRangeDate);

      // When
      const result = await service.getHistoryRanks(
        PointType.COMMITTED,
        weekendStartAt,
      );

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].count).toBe(3);
      expect(result[0].rank).toBe(1);

      expect(result[1].count).toBe(3);
      expect(result[1].rank).toBe(1); // 동점이므로 같은 등수

      expect(result[2].count).toBe(1);
      expect(result[2].rank).toBe(3); // 3등 (1등이 2명이었으므로)
    });

    it('범위 밖의 데이터는 조회되지 않는다', async () => {
      // Given
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');
      const outOfRangeDate = new Date('2026-01-20T12:00:00Z'); // 범위 밖

      // 범위 내 데이터
      await createHistory(player1, PointType.COMMITTED, inRangeDate);

      // 범위 밖 데이터
      await createHistory(player2, PointType.COMMITTED, outOfRangeDate);

      // When
      const result = await service.getHistoryRanks(
        PointType.COMMITTED,
        weekendStartAt,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].nickname).toBe('Player1');
    });

    it('다른 타입의 데이터는 조회되지 않는다', async () => {
      // Given
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');

      // COMMITTED 타입
      await createHistory(player1, PointType.COMMITTED, inRangeDate);
      await createHistory(player1, PointType.COMMITTED, inRangeDate);

      // PR_OPEN 타입 (다른 타입)
      await createHistory(player2, PointType.PR_OPEN, inRangeDate);

      // When: COMMITTED만 조회
      const result = await service.getHistoryRanks(
        PointType.COMMITTED,
        weekendStartAt,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].nickname).toBe('Player1');
      expect(result[0].count).toBe(2);
    });

    it('레코드가 없으면 빈 배열을 반환한다', async () => {
      // Given
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');

      // When
      const result = await service.getHistoryRanks(
        PointType.COMMITTED,
        weekendStartAt,
      );

      // Then
      expect(result).toHaveLength(0);
    });
  });

  describe('getHistoryRanks - FOCUSED 타입 분기', () => {
    const createFocusTime = async (
      player: Player,
      createdAt: Date,
      totalFocusSeconds: number,
    ): Promise<DailyFocusTime> => {
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusSeconds,
        status: FocusStatus.RESTING,
        createdAt,
      });
      return focusTimeRepository.save(focusTime);
    };

    it('type=FOCUSED일 때 FocusTimeService로 분기한다', async () => {
      // Given: FocusTime 데이터 준비
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');

      await createFocusTime(player1, inRangeDate, 3600); // 1시간
      await createFocusTime(player2, inRangeDate, 1800); // 30분

      // When
      const result = await service.getHistoryRanks(
        PointType.FOCUSED,
        weekendStartAt,
      );

      // Then: FocusTime 기반 결과 (초 단위)
      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(3600);
      expect(result[0].rank).toBe(1);
      expect(result[1].count).toBe(1800);
      expect(result[1].rank).toBe(2);
    });

    it('type=COMMITTED일 때 기존 로직을 사용한다', async () => {
      // Given: PointHistory 데이터와 FocusTime 데이터 모두 존재
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');

      // FocusTime 데이터
      await createFocusTime(player1, inRangeDate, 3600);

      // PointHistory 데이터
      await createHistory(player2, PointType.COMMITTED, inRangeDate);
      await createHistory(player2, PointType.COMMITTED, inRangeDate);

      // When: COMMITTED 타입 조회
      const result = await service.getHistoryRanks(
        PointType.COMMITTED,
        weekendStartAt,
      );

      // Then: PointHistory 기반 결과 (player2만, count=2)
      expect(result).toHaveLength(1);
      expect(result[0].playerId).toBe(player2.id);
      expect(result[0].count).toBe(2);
    });

    it('FOCUSED 타입에서 세밀한 시간 차이가 순위에 반영된다', async () => {
      // Given: player1=5490초, player2=5400초 (90초 차이)
      const weekendStartAt = new Date('2026-01-27T00:00:00Z');
      const inRangeDate = new Date('2026-01-28T12:00:00Z');

      await createFocusTime(player1, inRangeDate, 5490);
      await createFocusTime(player2, inRangeDate, 5400);

      // When
      const result = await service.getHistoryRanks(
        PointType.FOCUSED,
        weekendStartAt,
      );

      // Then: player1이 1등, player2가 2등 (90초 차이 반영)
      expect(result[0].playerId).toBe(player1.id);
      expect(result[0].rank).toBe(1);
      expect(result[1].playerId).toBe(player2.id);
      expect(result[1].rank).toBe(2);
    });
  });
  describe('addHistoryWithManager', () => {
    it('activityAt이 주어지면 createdAt으로 설정된다 (과거 날짜 기록)', async () => {
      // Given
      const playerId = player1.id;
      const type = PointType.TASK_COMPLETED;
      const amount = 1;
      const activityAt = new Date('2025-12-31T23:59:59Z'); // 과거 시점

      // 트랜잭션 매니저 대신 기존 repository의 manager 사용 (테스트 편의상)
      const manager = pointHistoryRepository.manager;

      // When
      const result = await service.addHistoryWithManager(
        manager,
        playerId,
        type,
        amount,
        null,
        null,
        activityAt,
      );

      // Then
      expect(result.createdAt).toEqual(activityAt);
      expect(result.activityAt).toEqual(activityAt);

      // DB 저장 확인
      const stored = await pointHistoryRepository.findOne({
        where: { id: result.id },
      });
      expect(stored?.createdAt).toEqual(activityAt);
    });

    it('activityAt이 없으면 현재 시각으로 생성된다', async () => {
      // Given
      const playerId = player1.id;
      const type = PointType.ISSUE_OPEN;
      const amount = 1;

      const manager = pointHistoryRepository.manager;

      // When
      const result = await service.addHistoryWithManager(
        manager,
        playerId,
        type,
        amount,
      );

      // Then
      expect(result.createdAt).toBeDefined();
      expect(result.activityAt).toBeNull();

      // 약 1초 내외 오차 허용 (DB 갔다오는 시간 고려)
      const now = new Date();
      const diff = Math.abs(now.getTime() - result.createdAt.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });
});
