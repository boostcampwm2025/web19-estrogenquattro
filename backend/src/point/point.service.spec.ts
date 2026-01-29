import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PointService } from './point.service';
import { DailyPoint } from './entities/daily-point.entity';
import { Player } from '../player/entites/player.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { Pet } from '../userpet/entities/pet.entity';
import { PointHistory } from '../pointhistory/entities/point-history.entity';
import { PointHistoryService } from '../pointhistory/point-history.service';

describe('PointService', () => {
  let service: PointService;
  let dailyPointRepository: Repository<DailyPoint>;
  let playerRepository: Repository<Player>;
  let module: TestingModule;

  let testPlayer: Player;
  let otherPlayer: Player;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [DailyPoint, Player, UserPet, Pet, PointHistory],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([DailyPoint, Player, PointHistory]),
      ],
      providers: [PointService, PointHistoryService],
    }).compile();

    service = module.get<PointService>(PointService);
    dailyPointRepository = module.get<Repository<DailyPoint>>(
      getRepositoryToken(DailyPoint),
    );
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
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
});
