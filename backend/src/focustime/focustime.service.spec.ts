import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FocusTimeService } from './focustime.service';
import { DailyFocusTime, FocusStatus } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { Pet } from '../userpet/entities/pet.entity';
import { Task } from '../task/entites/task.entity';

describe('FocusTimeService', () => {
  let service: FocusTimeService;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let playerRepository: Repository<Player>;
  let taskRepository: Repository<Task>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [DailyFocusTime, Player, UserPet, Pet, Task],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([DailyFocusTime, Player, Task]),
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
    taskRepository = module.get<Repository<Task>>(getRepositoryToken(Task));
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
    await taskRepository.clear();
    await playerRepository.clear();
  });

  describe('Date 비교 로직', () => {
    it('YYYY-MM-DD 문자열로 저장한 레코드를 같은 형식의 문자열로 조회할 수 있다', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성 (YYYY-MM-DD 문자열 사용)
      const player = await createTestPlayer('TestPlayer1');

      const today = new Date().toISOString().slice(0, 10);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusSeconds: 0,
        status: FocusStatus.RESTING,
        createdDate: today,
      });
      await focusTimeRepository.save(focusTime);

      // When: 같은 YYYY-MM-DD 문자열로 조회
      const queryDate = new Date().toISOString().slice(0, 10);
      const found = await focusTimeRepository.findOne({
        where: {
          player: { id: player.id },
          createdDate: queryDate,
        },
      });

      // Then: 레코드를 찾을 수 있어야 함
      expect(found).toBeDefined();
      expect(found?.id).toBe(focusTime.id);
    });

    it('SQLite에 저장된 date 컬럼의 실제 값을 확인한다', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성
      const player = await createTestPlayer('TestPlayer2');

      const today = new Date().toISOString().slice(0, 10);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusSeconds: 0,
        status: FocusStatus.RESTING,
        createdDate: today,
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

    it('string 타입으로 변경 후 올바른 형식으로 조회 성공', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성 (문자열로 저장)
      const player = await createTestPlayer('TestPlayer3');

      const today = new Date().toISOString().slice(0, 10);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusSeconds: 0,
        status: FocusStatus.RESTING,
        createdDate: today,
      });
      await focusTimeRepository.save(focusTime);

      // When: 같은 형식의 문자열로 조회 시도
      const found = await focusTimeRepository.findOne({
        where: {
          player: { id: player.id },
          createdDate: new Date().toISOString().slice(0, 10),
        },
      });

      // Then: string 타입으로 변경 후 조회 성공
      expect(found).toBeDefined();
      expect(found?.id).toBe(focusTime.id);
    });
  });

  describe('findOrCreate', () => {
    it('기존 레코드가 있으면 해당 레코드를 반환한다', async () => {
      // Given: 플레이어와 기존 FocusTime 레코드 (YYYY-MM-DD 문자열로 저장)
      const player = await createTestPlayer('TestPlayer4');

      const today = new Date().toISOString().slice(0, 10);
      const existing = focusTimeRepository.create({
        player,
        totalFocusSeconds: 30,
        status: FocusStatus.FOCUSING,
        createdDate: today,
      });
      await focusTimeRepository.save(existing);

      // When: findOrCreate 호출
      const result = await service.findOrCreate(player);

      // Then: 기존 레코드 반환
      expect(result.id).toBe(existing.id);
      expect(result.totalFocusSeconds).toBe(30);
    });

    it('기존 레코드가 없으면 새 레코드를 생성한다', async () => {
      // Given: 플레이어만 존재 (FocusTime 없음)
      const player = await createTestPlayer('TestPlayer5');

      // When: findOrCreate 호출
      const result = await service.findOrCreate(player);

      // Then: 새 레코드 생성됨
      expect(result).toBeDefined();
      expect(result.totalFocusSeconds).toBe(0);
      expect(result.status).toBe(FocusStatus.RESTING);
    });
  });

  describe('startFocusing', () => {
    it('taskId를 전달하면 currentTaskId가 저장된다', async () => {
      // Given: 플레이어와 FocusTime 레코드, Task 생성
      const player = await createTestPlayer('TestPlayer6');
      await service.findOrCreate(player);

      const task = taskRepository.create({
        player,
        description: '테스트 태스크',
        createdDate: new Date().toISOString().slice(0, 10),
      });
      await taskRepository.save(task);

      // When: startFocusing에 taskId 전달
      const result = await service.startFocusing(player.id, task.id);

      // Then: currentTask가 저장됨
      expect(result.currentTask?.id).toBe(task.id);
      expect(result.status).toBe(FocusStatus.FOCUSING);
    });

    it('taskId 없이 호출하면 currentTaskId가 null이다', async () => {
      // Given: 플레이어와 FocusTime 레코드
      const player = await createTestPlayer('TestPlayer7');
      await service.findOrCreate(player);

      // When: startFocusing에 taskId 없이 호출
      const result = await service.startFocusing(player.id);

      // Then: currentTask가 null
      expect(result.currentTask).toBeNull();
      expect(result.status).toBe(FocusStatus.FOCUSING);
    });
  });

  describe('startResting with Task', () => {
    it('currentTaskId가 있고 집중 시간이 있으면 Task의 totalFocusSeconds가 업데이트된다', async () => {
      // Given: 플레이어, FocusTime, Task 생성
      const player = await createTestPlayer('TestPlayer8');
      await service.findOrCreate(player);

      const task = taskRepository.create({
        player,
        description: '테스트 태스크',
        totalFocusSeconds: 100,
        createdDate: new Date().toISOString().slice(0, 10),
      });
      await taskRepository.save(task);

      // 집중 시작 (currentTaskId 설정)
      await service.startFocusing(player.id, task.id);

      // lastFocusStartTime을 과거로 직접 설정 (10초 전)
      await focusTimeRepository.update(
        { player: { id: player.id } },
        { lastFocusStartTime: new Date(Date.now() - 10000) },
      );

      // When: startResting 호출
      await service.startResting(player.id);

      // Then: Task의 totalFocusSeconds가 증가함
      const updatedTask = await taskRepository.findOne({
        where: { id: task.id },
      });
      expect(updatedTask.totalFocusSeconds).toBeGreaterThanOrEqual(110);
    });

    it('currentTaskId가 없으면 Task 업데이트가 발생하지 않는다', async () => {
      // Given: 플레이어와 FocusTime 생성 (taskId 없이 집중)
      const player = await createTestPlayer('TestPlayer9');
      await service.findOrCreate(player);

      // taskId 없이 집중 시작
      await service.startFocusing(player.id);

      // When: startResting 호출
      const result = await service.startResting(player.id);

      // Then: 정상적으로 RESTING 상태가 됨
      expect(result.status).toBe(FocusStatus.RESTING);
      expect(result.currentTask).toBeNull();
    });
  });
});
