import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FocusTimeService } from './focustime.service';
import { DailyFocusTime, FocusStatus } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { Pet } from '../userpet/entities/pet.entity';
import { Task } from '../task/entites/task.entity';
import { getTodayKstRangeUtc } from '../util/date.util';
import { BadRequestException } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

describe('FocusTimeService', () => {
  let service: FocusTimeService;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let playerRepository: Repository<Player>;
  let taskRepository: Repository<Task>;
  let dataSource: DataSource;
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
        DatabaseModule,
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
    dataSource = module.get<DataSource>(DataSource);
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
    it('datetime으로 저장한 레코드를 범위 쿼리로 조회할 수 있다', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성
      const player = await createTestPlayer('TestPlayer1');

      const { start, end } = getTodayKstRangeUtc();
      const testTime = new Date(start.getTime() + 60000); // start 이후 1분
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusSeconds: 0,
        createdAt: testTime,
      });
      await focusTimeRepository.save(focusTime);

      // When: 범위 쿼리로 조회
      const found = await focusTimeRepository
        .createQueryBuilder('ft')
        .where('ft.player.id = :playerId', { playerId: player.id })
        .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
        .getOne();

      // Then: 레코드를 찾을 수 있어야 함
      expect(found).toBeDefined();
      expect(found?.id).toBe(focusTime.id);
    });

    it('SQLite에 저장된 datetime 컬럼의 실제 값을 확인한다', async () => {
      // Given: 플레이어와 FocusTime 레코드 생성
      const player = await createTestPlayer('TestPlayer2');

      const { start } = getTodayKstRangeUtc();
      const testTime = new Date(start.getTime() + 60000);
      const focusTime = focusTimeRepository.create({
        player,
        totalFocusSeconds: 0,
        createdAt: testTime,
      });
      await focusTimeRepository.save(focusTime);

      // When: Raw query로 실제 저장된 값 확인
      const raw: { created_at: string }[] = await focusTimeRepository.query(
        'SELECT created_at FROM daily_focus_time WHERE id = ?',
        [focusTime.id],
      );

      // Then: 저장된 형식 출력
      console.log('Input Date:', testTime.toISOString());
      console.log('Stored value in SQLite:', raw[0].created_at);

      expect(raw[0].created_at).toBeDefined();
    });
  });

  describe('findOrCreate (V2)', () => {
    it('기존 레코드가 있으면 해당 레코드를 반환한다', async () => {
      // Given: 플레이어와 기존 FocusTime 레코드
      const player = await createTestPlayer('TestPlayer4');

      const { start } = getTodayKstRangeUtc();
      const existing = focusTimeRepository.create({
        player,
        totalFocusSeconds: 30,
        createdAt: start,
      });
      await focusTimeRepository.save(existing);

      // When: findOrCreate 호출 (트랜잭션 내)
      const result = await dataSource.transaction(async (manager) => {
        return service.findOrCreate(manager, player, start);
      });

      // Then: 기존 레코드 반환
      expect(result.id).toBe(existing.id);
      expect(result.totalFocusSeconds).toBe(30);
    });

    it('기존 레코드가 없으면 새 레코드를 생성한다', async () => {
      // Given: 플레이어만 존재 (FocusTime 없음)
      const player = await createTestPlayer('TestPlayer5');

      // When: findOrCreate 호출 (트랜잭션 내)
      const { start } = getTodayKstRangeUtc();
      const result = await dataSource.transaction(async (manager) => {
        return service.findOrCreate(manager, player, start);
      });

      // Then: 새 레코드 생성됨
      expect(result).toBeDefined();
      expect(result.totalFocusSeconds).toBe(0);
    });
  });

  describe('startFocusing (V2)', () => {
    it('존재하지 않는 playerId로 호출하면 BadRequestException을 던진다', async () => {
      // When & Then
      await expect(service.startFocusing(99999)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startFocusing(99999)).rejects.toThrow(
        'Player not found',
      );
    });

    it('다른 플레이어 소유의 taskId로 호출하면 BadRequestException을 던진다', async () => {
      // Given: 두 플레이어와 하나의 Task
      const player1 = await createTestPlayer('Player1');
      const player2 = await createTestPlayer('Player2');
      const { start } = getTodayKstRangeUtc();
      const testTime = new Date(start.getTime() + 60000);

      const task = taskRepository.create({
        player: player1,
        description: 'Player1의 태스크',
        createdAt: testTime,
      });
      await taskRepository.save(task);

      // When & Then: player2가 player1의 task로 집중 시도
      await expect(service.startFocusing(player2.id, task.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startFocusing(player2.id, task.id)).rejects.toThrow(
        'Task not found or not owned by player',
      );
    });

    it('존재하지 않는 taskId로 호출하면 BadRequestException을 던진다', async () => {
      // Given
      const player = await createTestPlayer('TestPlayer');

      // When & Then
      await expect(service.startFocusing(player.id, 99999)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('taskId를 전달하면 player.focusingTaskId가 저장된다', async () => {
      // Given: 플레이어와 Task 생성
      const player = await createTestPlayer('TestPlayer6');
      const { start } = getTodayKstRangeUtc();
      const testTime = new Date(start.getTime() + 60000);

      const task = taskRepository.create({
        player,
        description: '테스트 태스크',
        createdAt: testTime,
      });
      await taskRepository.save(task);

      // When: startFocusing에 taskId 전달
      const result = await service.startFocusing(player.id, task.id);

      // Then: player.focusingTaskId가 저장됨
      expect(result.focusingTaskId).toBe(task.id);
      expect(result.lastFocusStartTime).toBeDefined();
    });

    it('taskId 없이 호출하면 focusingTaskId가 null이다', async () => {
      // Given: 플레이어만 존재
      const player = await createTestPlayer('TestPlayer7');

      // When: startFocusing에 taskId 없이 호출
      const result = await service.startFocusing(player.id);

      // Then: focusingTaskId가 null (글로벌 타이머)
      expect(result.focusingTaskId).toBeNull();
      expect(result.lastFocusStartTime).toBeDefined();
    });
  });

  describe('startResting (V2)', () => {
    it('존재하지 않는 playerId로 호출하면 BadRequestException을 던진다', async () => {
      // When & Then
      await expect(service.startResting(99999)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startResting(99999)).rejects.toThrow(
        'Player not found',
      );
    });

    it('집중 중이면 시간을 정산하고 player 상태를 초기화한다', async () => {
      // Given: 집중 시작
      const player = await createTestPlayer('TestPlayer8');
      await service.startFocusing(player.id);

      // lastFocusStartTime을 과거로 직접 설정 (10초 전)
      await playerRepository.update(
        { id: player.id },
        { lastFocusStartTime: new Date(Date.now() - 10000) },
      );

      // When: startResting 호출
      const result = await service.startResting(player.id);

      // Then: 시간이 정산되고 player 상태가 초기화됨
      expect(result.totalFocusSeconds).toBeGreaterThanOrEqual(10);

      const updatedPlayer = await playerRepository.findOne({
        where: { id: player.id },
      });
      expect(updatedPlayer?.focusingTaskId).toBeNull();
      expect(updatedPlayer?.lastFocusStartTime).toBeNull();
    });

    it('집중 중이 아니면 아무 작업도 하지 않는다', async () => {
      // Given: 플레이어만 존재 (집중 시작 안 함)
      const player = await createTestPlayer('TestPlayer9');

      // When: startResting 호출
      const result = await service.startResting(player.id);

      // Then: 아무 변화 없음
      expect(result.totalFocusSeconds).toBe(0);
    });

    it('Task에 집중 시간이 누적된다', async () => {
      // Given: 플레이어와 Task 생성, 집중 시작
      const player = await createTestPlayer('TestPlayer10');
      const { start } = getTodayKstRangeUtc();
      const testTime = new Date(start.getTime() + 60000);

      const task = taskRepository.create({
        player,
        description: '테스트 태스크',
        totalFocusSeconds: 100,
        createdAt: testTime,
      });
      await taskRepository.save(task);

      // 집중 시작 (taskId 포함)
      await service.startFocusing(player.id, task.id);

      // lastFocusStartTime을 과거로 직접 설정 (10초 전)
      await playerRepository.update(
        { id: player.id },
        { lastFocusStartTime: new Date(Date.now() - 10000) },
      );

      // When: startResting 호출
      await service.startResting(player.id);

      // Then: Task의 totalFocusSeconds가 증가함
      const updatedTask = await taskRepository.findOne({
        where: { id: task.id },
      });
      expect(updatedTask!.totalFocusSeconds).toBeGreaterThanOrEqual(110);
    });
  });

  describe('settleStaleSession', () => {
    it('집중 중인 세션이 있으면 정산하고 상태를 초기화한다', async () => {
      // Given: 집중 중인 플레이어
      const player = await createTestPlayer('TestPlayer11');
      await service.startFocusing(player.id);

      // lastFocusStartTime을 과거로 설정 (10초 전)
      await playerRepository.update(
        { id: player.id },
        { lastFocusStartTime: new Date(Date.now() - 10000) },
      );

      // When: settleStaleSession 호출
      await service.settleStaleSession(player.id);

      // Then: player 상태가 초기화됨
      const updatedPlayer = await playerRepository.findOne({
        where: { id: player.id },
      });
      expect(updatedPlayer?.focusingTaskId).toBeNull();
      expect(updatedPlayer?.lastFocusStartTime).toBeNull();

      // daily_focus_time에 시간이 누적됨
      const { start, end } = getTodayKstRangeUtc();
      const focusTime = await focusTimeRepository
        .createQueryBuilder('ft')
        .where('ft.player.id = :playerId', { playerId: player.id })
        .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
        .getOne();
      expect(focusTime?.totalFocusSeconds).toBeGreaterThanOrEqual(10);
    });

    it('집중 중이 아니면 아무 작업도 하지 않는다', async () => {
      // Given: 집중 중이 아닌 플레이어
      const player = await createTestPlayer('TestPlayer12');

      // When: settleStaleSession 호출
      await service.settleStaleSession(player.id);

      // Then: 아무 변화 없음
      const updatedPlayer = await playerRepository.findOne({
        where: { id: player.id },
      });
      expect(updatedPlayer?.focusingTaskId).toBeNull();
      expect(updatedPlayer?.lastFocusStartTime).toBeNull();
    });

    it('존재하지 않는 playerId면 아무 작업도 하지 않는다', async () => {
      // When & Then: 예외 없이 완료
      await expect(service.settleStaleSession(99999)).resolves.not.toThrow();
    });
  });

  describe('findAllStatuses', () => {
    it('여러 플레이어의 집중 상태를 조회한다', async () => {
      // Given: 여러 플레이어 (하나는 집중 중, 하나는 휴식 중)
      const player1 = await createTestPlayer('TestPlayer13');
      const player2 = await createTestPlayer('TestPlayer14');

      await service.startFocusing(player1.id);
      // player2는 집중 시작하지 않음

      // When
      const statuses = await service.findAllStatuses([player1.id, player2.id]);

      // Then
      expect(statuses).toHaveLength(2);

      const status1 = statuses.find((s) => s.playerId === player1.id);
      expect(status1?.isFocusing).toBe(true);
      expect(status1?.lastFocusStartTime).toBeDefined();

      const status2 = statuses.find((s) => s.playerId === player2.id);
      expect(status2?.isFocusing).toBe(false);
      expect(status2?.lastFocusStartTime).toBeNull();
    });

    it('빈 배열을 전달하면 빈 배열을 반환한다', async () => {
      // When
      const statuses = await service.findAllStatuses([]);

      // Then
      expect(statuses).toEqual([]);
    });
  });

  describe('getPlayerFocusStatus', () => {
    it('존재하지 않는 playerId로 호출하면 BadRequestException을 던진다', async () => {
      // When & Then
      await expect(service.getPlayerFocusStatus(99999)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getPlayerFocusStatus(99999)).rejects.toThrow(
        'Player not found',
      );
    });

    it('집중 중인 플레이어의 상태를 조회한다', async () => {
      // Given: 집중 중인 플레이어
      const player = await createTestPlayer('TestPlayer15');
      await service.startFocusing(player.id);

      // When
      const status = await service.getPlayerFocusStatus(player.id);

      // Then
      expect(status.isFocusing).toBe(true);
      expect(status.lastFocusStartTime).toBeDefined();
      expect(status.currentSessionSeconds).toBeGreaterThanOrEqual(0);
    });

    it('휴식 중인 플레이어의 상태를 조회한다', async () => {
      // Given: 휴식 중인 플레이어
      const player = await createTestPlayer('TestPlayer16');

      // When
      const status = await service.getPlayerFocusStatus(player.id);

      // Then
      expect(status.isFocusing).toBe(false);
      expect(status.lastFocusStartTime).toBeNull();
      expect(status.currentSessionSeconds).toBe(0);
    });
  });

  describe('getFocusRanks', () => {
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

    it('주간 범위 내 여러 일자의 집중 시간이 합산된다', async () => {
      // Given: playerA가 월요일 1시간, 화요일 30분 집중
      const playerA = await createTestPlayer('PlayerA');
      const mondayStart = new Date('2026-01-26T00:00:00Z');
      const monday = new Date('2026-01-26T12:00:00Z');
      const tuesday = new Date('2026-01-27T12:00:00Z');

      await createFocusTime(playerA, monday, 3600); // 1시간
      await createFocusTime(playerA, tuesday, 1800); // 30분

      // When
      const ranks = await service.getFocusRanks(mondayStart);

      // Then: 총 5400초 (1시간 30분)
      expect(ranks).toHaveLength(1);
      expect(ranks[0].count).toBe(5400);
    });

    it('세밀한 시간 차이가 순위에 반영된다', async () => {
      // Given: A=5490초, B=5400초 (90초 차이)
      const playerA = await createTestPlayer('PlayerA');
      const playerB = await createTestPlayer('PlayerB');
      const mondayStart = new Date('2026-01-26T00:00:00Z');
      const monday = new Date('2026-01-26T12:00:00Z');

      await createFocusTime(playerA, monday, 5490);
      await createFocusTime(playerB, monday, 5400);

      // When
      const ranks = await service.getFocusRanks(mondayStart);

      // Then: A가 1등, B가 2등 (이전에는 동점 처리됨)
      expect(ranks[0].playerId).toBe(playerA.id);
      expect(ranks[0].rank).toBe(1);
      expect(ranks[1].playerId).toBe(playerB.id);
      expect(ranks[1].rank).toBe(2);
    });

    it('집중 시간이 0인 플레이어는 제외된다', async () => {
      // Given: A=3600초, B=0초
      const playerA = await createTestPlayer('PlayerA');
      const playerB = await createTestPlayer('PlayerB');
      const mondayStart = new Date('2026-01-26T00:00:00Z');
      const monday = new Date('2026-01-26T12:00:00Z');

      await createFocusTime(playerA, monday, 3600);
      await createFocusTime(playerB, monday, 0);

      // When
      const ranks = await service.getFocusRanks(mondayStart);

      // Then: B는 결과에 없어야 함
      expect(ranks.map((r) => r.playerId)).not.toContain(playerB.id);
      expect(ranks).toHaveLength(1);
    });

    it('동점자는 같은 순위를 부여한다 (Standard Competition Ranking)', async () => {
      // Given: A=3600초, B=3600초, C=1800초
      const playerA = await createTestPlayer('PlayerA');
      const playerB = await createTestPlayer('PlayerB');
      const playerC = await createTestPlayer('PlayerC');
      const mondayStart = new Date('2026-01-26T00:00:00Z');
      const monday = new Date('2026-01-26T12:00:00Z');

      await createFocusTime(playerA, monday, 3600);
      await createFocusTime(playerB, monday, 3600);
      await createFocusTime(playerC, monday, 1800);

      // When
      const ranks = await service.getFocusRanks(mondayStart);

      // Then: A,B=1등, C=3등 (2등 없음)
      expect(ranks.filter((r) => r.rank === 1)).toHaveLength(2);
      expect(ranks.find((r) => r.playerId === playerC.id)?.rank).toBe(3);
    });

    it('범위 밖의 데이터는 조회되지 않는다', async () => {
      // Given
      const playerA = await createTestPlayer('PlayerA');
      const mondayStart = new Date('2026-01-26T00:00:00Z');
      const inRangeDate = new Date('2026-01-27T12:00:00Z');
      const outOfRangeDate = new Date('2026-01-20T12:00:00Z'); // 범위 밖

      await createFocusTime(playerA, inRangeDate, 3600);
      await createFocusTime(playerA, outOfRangeDate, 7200);

      // When
      const ranks = await service.getFocusRanks(mondayStart);

      // Then: 범위 내 데이터만 조회 (3600초)
      expect(ranks).toHaveLength(1);
      expect(ranks[0].count).toBe(3600);
    });

    it('레코드가 없으면 빈 배열을 반환한다', async () => {
      // Given: 데이터 없음
      const mondayStart = new Date('2026-01-26T00:00:00Z');

      // When
      const ranks = await service.getFocusRanks(mondayStart);

      // Then
      expect(ranks).toHaveLength(0);
    });
  });
});
