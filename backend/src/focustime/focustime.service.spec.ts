import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FocusTimeService } from './focustime.service';
import { DailyFocusTime, FocusStatus } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';

describe('FocusTimeService', () => {
  let service: FocusTimeService;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let playerRepository: Repository<Player>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [DailyFocusTime, Player],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([DailyFocusTime, Player]),
      ],
      providers: [FocusTimeService],
    }).compile();

    service = module.get<FocusTimeService>(FocusTimeService);
    focusTimeRepository = module.get<Repository<DailyFocusTime>>(
      getRepositoryToken(DailyFocusTime),
    );
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  let playerIdCounter = 1000;

  const createTestPlayer = async (nickname: string): Promise<Player> => {
    const player = playerRepository.create({
      socialId: playerIdCounter++,
      nickname,
    });
    return playerRepository.save(player);
  };

  beforeEach(async () => {
    // 각 테스트 전 데이터 초기화
    await focusTimeRepository.clear();
    await playerRepository.clear();
  });

  describe('Date 비교 로직', () => {
    it('YYYY-MM-DD 문자열로 저장한 레코드를 같은 형식의 문자열로 조회할 수 있다', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성 (YYYY-MM-DD 문자열 사용)
      const player = await createTestPlayer('TestPlayer1');

      const today = new Date().toISOString().slice(0, 10);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusMinutes: 0,
        status: FocusStatus.RESTING,
        createdDate: today as unknown as Date,
      });
      await focusTimeRepository.save(focusTime);

      // When: 같은 YYYY-MM-DD 문자열로 조회
      const queryDate = new Date().toISOString().slice(0, 10);
      const found = await focusTimeRepository.findOne({
        where: {
          player: { id: player.id },
          createdDate: queryDate as unknown as Date,
        },
      });

      // Then: 레코드를 찾을 수 있어야 함
      expect(found).toBeDefined();
      expect(found.id).toBe(focusTime.id);
    });

    it('SQLite에 저장된 date 컬럼의 실제 값을 확인한다', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성
      const player = await createTestPlayer('TestPlayer2');

      const today = new Date().toISOString().slice(0, 10);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusMinutes: 0,
        status: FocusStatus.RESTING,
        createdDate: today as unknown as Date,
      });
      await focusTimeRepository.save(focusTime);

      // When: Raw query로 실제 저장된 값 확인
      const raw: { created_date: string }[] = await focusTimeRepository.query(
        'SELECT created_date FROM daily_focus_time WHERE id = ?',
        [focusTime.id],
      );

      // Then: 저장된 형식 출력
      console.log('Input Date String:', today);
      console.log('Stored value in SQLite:', raw[0].created_date);

      expect(raw[0].created_date).toBe(today);
    });

    it('new Date() 객체로는 조회할 수 없다 (기존 버그 확인용)', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성 (문자열로 저장)
      const player = await createTestPlayer('TestPlayer3');

      const today = new Date().toISOString().slice(0, 10);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusMinutes: 0,
        status: FocusStatus.RESTING,
        createdDate: today as unknown as Date,
      });
      await focusTimeRepository.save(focusTime);

      // When: new Date() 객체로 조회 시도
      const found = await focusTimeRepository.findOne({
        where: {
          player: { id: player.id },
          createdDate: new Date(),
        },
      });

      // Then: 조회 실패 (이것이 기존 버그였음)
      expect(found).toBeNull();
    });
  });

  describe('findOrCreate', () => {
    it('기존 레코드가 있으면 해당 레코드를 반환한다', async () => {
      // Given: 플레이어와 기존 FocusTime 레코드 (YYYY-MM-DD 문자열로 저장)
      const player = await createTestPlayer('TestPlayer4');

      const today = new Date().toISOString().slice(0, 10);
      const existing = focusTimeRepository.create({
        player,
        totalFocusMinutes: 30,
        status: FocusStatus.FOCUSING,
        createdDate: today as unknown as Date,
      });
      await focusTimeRepository.save(existing);

      // When: findOrCreate 호출
      const result = await service.findOrCreate(player);

      // Then: 기존 레코드 반환
      expect(result.id).toBe(existing.id);
      expect(result.totalFocusMinutes).toBe(30);
    });

    it('기존 레코드가 없으면 새 레코드를 생성한다', async () => {
      // Given: 플레이어만 존재 (FocusTime 없음)
      const player = await createTestPlayer('TestPlayer5');

      // When: findOrCreate 호출
      const result = await service.findOrCreate(player);

      // Then: 새 레코드 생성됨
      expect(result).toBeDefined();
      expect(result.totalFocusMinutes).toBe(0);
      expect(result.status).toBe(FocusStatus.RESTING);
    });
  });
});
