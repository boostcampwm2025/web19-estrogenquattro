import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PointService, ACTIVITY_POINT_MAP } from './point.service';
import { DailyPoint } from './entities/daily-point.entity';
import { Player } from '../player/entites/player.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { Pet } from '../userpet/entities/pet.entity';
import {
  PointHistory,
  PointType,
} from '../pointhistory/entities/point-history.entity';
import { PointHistoryService } from '../pointhistory/point-history.service';
import { DatabaseModule } from '../database/database.module';
import { FocusTimeService } from '../focustime/focustime.service';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { TaskService } from '../task/task.service';
import { PlayerService } from '../player/player.service';

describe('PointService', () => {
  let service: PointService;
  let dailyPointRepository: Repository<DailyPoint>;
  let playerRepository: Repository<Player>;
  let pointHistoryRepository: Repository<PointHistory>;
  let module: TestingModule;

  let testPlayer: Player;
  let otherPlayer: Player;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            DailyPoint,
            Player,
            UserPet,
            Pet,
            PointHistory,
            DailyFocusTime,
            Task,
          ],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          DailyPoint,
          Player,
          PointHistory,
          DailyFocusTime,
          Task,
        ]),
        DatabaseModule,
      ],
      providers: [
        PointService,
        PointHistoryService,
        FocusTimeService,
        TaskService,
        PlayerService,
      ],
    }).compile();

    service = module.get<PointService>(PointService);
    dailyPointRepository = module.get<Repository<DailyPoint>>(
      getRepositoryToken(DailyPoint),
    );
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
    pointHistoryRepository = module.get<Repository<PointHistory>>(
      getRepositoryToken(PointHistory),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // FK 제약 조건 순서: point_history → daily_point → player
    await pointHistoryRepository.clear();
    await dailyPointRepository.clear();
    await playerRepository.clear();

    // 테스트용 플레이어 생성
    testPlayer = await playerRepository.save(
      playerRepository.create({
        socialId: 12345,
        nickname: 'TestPlayer',
        totalPoint: 0,
      }),
    );

    otherPlayer = await playerRepository.save(
      playerRepository.create({
        socialId: 67890,
        nickname: 'OtherPlayer',
        totalPoint: 0,
      }),
    );
  });

  describe('getPoints', () => {
    it('자신의 포인트를 조회할 수 있다', async () => {
      // Given: 테스트 플레이어의 포인트 데이터 생성
      const currentTime = new Date();
      const pointData = dailyPointRepository.create({
        player: testPlayer,
        amount: 100,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 60 * 24), // 1일 전
      });
      await dailyPointRepository.save(pointData);

      // When: 자신의 포인트 조회
      const result = await service.getPoints(
        testPlayer.id,
        testPlayer.id,
        currentTime,
      );

      // Then: 포인트 데이터가 조회됨
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100);
    });

    it('타인의 포인트를 조회할 수 있다', async () => {
      // Given: 다른 플레이어의 포인트 데이터 생성
      const currentTime = new Date();
      const pointData = dailyPointRepository.create({
        player: otherPlayer,
        amount: 200,
        createdAt: new Date(currentTime.getTime() - 1000 * 60 * 60 * 24), // 1일 전
      });
      await dailyPointRepository.save(pointData);

      // When: 다른 플레이어의 포인트 조회
      const result = await service.getPoints(
        testPlayer.id,
        otherPlayer.id,
        currentTime,
      );

      // Then: 다른 플레이어의 포인트 데이터가 조회됨
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(200);
    });

    it('currentTime 기준 1년치 데이터만 조회된다', async () => {
      // Given: 1년 이내 데이터와 1년 이전 데이터 생성
      const currentTime = new Date();

      // 6개월 전 데이터 (조회 대상)
      const sixMonthsAgo = new Date(currentTime);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      await dailyPointRepository.save(
        dailyPointRepository.create({
          player: testPlayer,
          amount: 100,
          createdAt: sixMonthsAgo,
        }),
      );

      // 2년 전 데이터 (조회 대상 아님)
      const twoYearsAgo = new Date(currentTime);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      await dailyPointRepository.save(
        dailyPointRepository.create({
          player: testPlayer,
          amount: 50,
          createdAt: twoYearsAgo,
        }),
      );

      // When: 포인트 조회
      const result = await service.getPoints(
        testPlayer.id,
        testPlayer.id,
        currentTime,
      );

      // Then: 1년 이내 데이터만 조회됨
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100);
    });

    it('존재하지 않는 currentPlayerId로 조회 시 NotFoundException을 던진다', async () => {
      // When & Then
      const currentTime = new Date();
      await expect(
        service.getPoints(99999, testPlayer.id, currentTime),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPoints(99999, testPlayer.id, currentTime),
      ).rejects.toThrow('Player with ID 99999 not found');
    });

    it('존재하지 않는 targetPlayerId로 조회 시 NotFoundException을 던진다', async () => {
      // When & Then
      const currentTime = new Date();
      await expect(
        service.getPoints(testPlayer.id, 99999, currentTime),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPoints(testPlayer.id, 99999, currentTime),
      ).rejects.toThrow('Player with ID 99999 not found');
    });

    it('포인트 데이터가 없을 때 빈 배열을 반환한다', async () => {
      // Given: 포인트 데이터 없음
      const currentTime = new Date();

      // When: 포인트 조회
      const result = await service.getPoints(
        testPlayer.id,
        testPlayer.id,
        currentTime,
      );

      // Then: 빈 배열 반환
      expect(result).toHaveLength(0);
    });
  });

  describe('addPoint', () => {
    it('GitHub 활동 시 activityAt이 저장된다', async () => {
      // Given: GitHub 활동 시간
      const activityAt = new Date('2026-01-29T10:30:00Z');

      // When: 커밋 포인트 적립
      await service.addPoint(
        testPlayer.id,
        PointType.COMMITTED,
        1,
        'owner/repo',
        'feat: 새 기능 추가',
        activityAt,
      );

      // Then: point_history에 activityAt이 저장됨
      const history = await pointHistoryRepository.findOne({
        where: { player: { id: testPlayer.id } },
      });

      expect(history).toBeDefined();
      expect(history!.type).toBe(PointType.COMMITTED);
      expect(history!.repository).toBe('owner/repo');
      expect(history!.description).toBe('feat: 새 기능 추가');
      expect(history!.activityAt).toEqual(activityAt);
      expect(history!.amount).toBe(ACTIVITY_POINT_MAP[PointType.COMMITTED]);
    });

    it('TASK_COMPLETED는 activityAt이 null로 저장된다', async () => {
      // Given: Task 완료 (GitHub 활동 아님)

      // When: Task 완료 포인트 적립 (activityAt 미전달)
      await service.addPoint(
        testPlayer.id,
        PointType.TASK_COMPLETED,
        1,
        null,
        '오늘 할 일',
      );

      // Then: point_history에 activityAt이 null로 저장됨
      const history = await pointHistoryRepository.findOne({
        where: { player: { id: testPlayer.id } },
      });

      expect(history).toBeDefined();
      expect(history!.type).toBe(PointType.TASK_COMPLETED);
      expect(history!.activityAt).toBeNull();
    });

    it('FOCUSED는 activityAt이 null로 저장된다', async () => {
      // Given: 집중 시간 (GitHub 활동 아님)

      // When: 집중 포인트 적립 (activityAt 미전달)
      await service.addPoint(testPlayer.id, PointType.FOCUSED, 1, null, null);

      // Then: point_history에 activityAt이 null로 저장됨
      const history = await pointHistoryRepository.findOne({
        where: { player: { id: testPlayer.id } },
      });

      expect(history).toBeDefined();
      expect(history!.type).toBe(PointType.FOCUSED);
      expect(history!.activityAt).toBeNull();
    });

    it('PR 생성 시 activityAt이 저장된다', async () => {
      // Given: PR 생성 이벤트 시간
      const activityAt = new Date('2026-01-29T11:00:00Z');

      // When: PR 생성 포인트 적립
      await service.addPoint(
        testPlayer.id,
        PointType.PR_OPEN,
        1,
        'owner/repo',
        'feat: 로그인 기능 구현',
        activityAt,
      );

      // Then: point_history에 activityAt이 저장됨
      const history = await pointHistoryRepository.findOne({
        where: { player: { id: testPlayer.id } },
      });

      expect(history).toBeDefined();
      expect(history!.type).toBe(PointType.PR_OPEN);
      expect(history!.activityAt).toEqual(activityAt);
      expect(history!.amount).toBe(ACTIVITY_POINT_MAP[PointType.PR_OPEN]);
    });

    it('포인트 적립 시 player.totalPoint가 증가한다', async () => {
      // Given: 초기 포인트 0

      // When: 커밋 포인트 적립
      await service.addPoint(
        testPlayer.id,
        PointType.COMMITTED,
        1,
        'owner/repo',
        'feat: 기능 추가',
        new Date(),
      );

      // Then: player.totalPoint 증가
      const updatedPlayer = await playerRepository.findOne({
        where: { id: testPlayer.id },
      });

      expect(updatedPlayer!.totalPoint).toBe(
        ACTIVITY_POINT_MAP[PointType.COMMITTED],
      );
    });

    it('포인트 적립 시 dailyPoint가 생성/업데이트된다', async () => {
      // Given: dailyPoint 없음

      // When: 포인트 2번 적립
      await service.addPoint(
        testPlayer.id,
        PointType.COMMITTED,
        1,
        'owner/repo',
        'feat: 기능1',
        new Date(),
      );
      await service.addPoint(
        testPlayer.id,
        PointType.PR_OPEN,
        1,
        'owner/repo',
        'feat: PR',
        new Date(),
      );

      // Then: dailyPoint에 합산됨
      const dailyPoints = await dailyPointRepository.find({
        where: { player: { id: testPlayer.id } },
      });

      expect(dailyPoints).toHaveLength(1);
      expect(dailyPoints[0].amount).toBe(
        ACTIVITY_POINT_MAP[PointType.COMMITTED] +
          ACTIVITY_POINT_MAP[PointType.PR_OPEN],
      );
    });
  });
});
