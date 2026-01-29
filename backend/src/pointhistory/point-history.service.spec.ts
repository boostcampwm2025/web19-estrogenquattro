import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PointHistoryService } from './point-history.service';
import { PointHistory, PointType } from './entities/point-history.entity';
import { Player } from '../player/entites/player.entity';
import { Pet } from '../userpet/entities/pet.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';

describe('PointHistoryService', () => {
  let service: PointHistoryService;
  let pointHistoryRepository: Repository<PointHistory>;
  let playerRepository: Repository<Player>;
  let module: TestingModule;
  let dataSource: DataSource;

  let player1: Player;
  let player2: Player;
  let player3: Player;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [PointHistory, Player, Pet, UserPet],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([PointHistory, Player]),
      ],
      providers: [PointHistoryService],
    }).compile();

    service = module.get<PointHistoryService>(PointHistoryService);
    pointHistoryRepository = module.get<Repository<PointHistory>>(
      getRepositoryToken(PointHistory),
    );
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
    dataSource = module.get<DataSource>(DataSource);
  }, 30000);

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await pointHistoryRepository.clear();
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
});
