import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from './entites/task.entity';
import { PlayerService } from '../player/player.service';
import { Player } from '../player/entites/player.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { Pet } from '../userpet/entities/pet.entity';

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: Repository<Task>;
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
          entities: [Task, Player, UserPet, Pet],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Task, Player]),
      ],
      providers: [TaskService, PlayerService],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepository = module.get<Repository<Task>>(getRepositoryToken(Task));
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await taskRepository.clear();
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

  const createTestTask = async (
    player: Player,
    description: string,
    createdAt?: Date,
  ): Promise<Task> => {
    const task = taskRepository.create({
      player,
      description,
      createdAt: createdAt ?? new Date(),
    });
    return taskRepository.save(task);
  };

  describe('createTask', () => {
    it('새 할 일을 생성한다', async () => {
      // When
      const result = await service.createTask({
        playerId: testPlayer.id,
        description: '새로운 할 일',
      });

      // Then
      expect(result).toBeDefined();
      expect(result.description).toBe('새로운 할 일');
      expect(result.isCompleted).toBe(false);
      expect(result.totalFocusSeconds).toBe(0);
    });

    it('존재하지 않는 플레이어로 생성 시 NotFoundException을 던진다', async () => {
      // When & Then
      await expect(
        service.createTask({
          playerId: 99999,
          description: '할 일',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTasks', () => {
    it('오늘 날짜의 미완료 할 일을 조회한다', async () => {
      // Given
      const now = new Date();
      await createTestTask(testPlayer, '할 일 1', now);
      await createTestTask(testPlayer, '할 일 2', now);

      // When
      const result = await service.getTasks(testPlayer.id);

      // Then
      expect(result.tasks).toHaveLength(2);
    });

    it('오늘 완료된 할 일도 조회된다', async () => {
      // Given
      const now = new Date();
      const task = await createTestTask(testPlayer, '오늘 완료 할 일', now);
      task.completedAt = now;
      await taskRepository.save(task);

      // When
      const result = await service.getTasks(testPlayer.id);

      // Then
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].isCompleted).toBe(true);
    });

    it('과거 날짜를 지정하여 조회한다', async () => {
      // Given: KST 어제에 해당하는 UTC 시간으로 태스크 생성
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const yesterdayKst = new Date(kstNow);
      yesterdayKst.setUTCDate(yesterdayKst.getUTCDate() - 1);
      const yesterdayDateStr = yesterdayKst.toISOString().slice(0, 10);

      // KST 어제 중간 시간 (UTC 기준)
      const [year, month, day] = yesterdayDateStr.split('-').map(Number);
      const yesterdayUtc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)); // KST 12:00
      await createTestTask(testPlayer, '어제 할 일', yesterdayUtc);

      // When
      const result = await service.getTasks(testPlayer.id, yesterdayDateStr);

      // Then
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].description).toBe('어제 할 일');
    });

    it('다른 날짜의 할 일은 조회되지 않는다', async () => {
      // Given: KST 어제에 해당하는 UTC 시간으로 태스크 생성
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const yesterdayKst = new Date(kstNow);
      yesterdayKst.setUTCDate(yesterdayKst.getUTCDate() - 1);
      const yesterdayDateStr = yesterdayKst.toISOString().slice(0, 10);

      const [year, month, day] = yesterdayDateStr.split('-').map(Number);
      const yesterdayUtc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
      await createTestTask(testPlayer, '어제 할 일', yesterdayUtc);

      // When
      const result = await service.getTasks(testPlayer.id); // 오늘 날짜로 조회

      // Then
      expect(result.tasks).toHaveLength(0);
    });

    it('다른 플레이어의 할 일은 조회되지 않는다', async () => {
      // Given
      const now = new Date();
      await createTestTask(testPlayer, '내 할 일', now);
      await createTestTask(otherPlayer, '다른 사람 할 일', now);

      // When
      const result = await service.getTasks(testPlayer.id);

      // Then
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].description).toBe('내 할 일');
    });

    it('존재하지 않는 플레이어로 조회 시 NotFoundException을 던진다', async () => {
      // When & Then
      await expect(service.getTasks(99999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneById', () => {
    it('ID로 할 일을 조회한다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '할 일');

      // When
      const result = await service.findOneById(task.id);

      // Then
      expect(result).toBeDefined();
      expect(result.id).toBe(task.id);
      expect(result.player).toBeDefined();
    });

    it('존재하지 않는 ID로 조회 시 NotFoundException을 던진다', async () => {
      // When & Then
      await expect(service.findOneById(99999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneById(99999)).rejects.toThrow(
        'Task with ID 99999 not found',
      );
    });
  });

  describe('completeTask', () => {
    it('할 일을 완료 처리한다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '완료할 할 일');

      // When
      const result = await service.completeTask(task.id, testPlayer.id);

      // Then
      expect(result.isCompleted).toBe(true);
    });

    it('다른 플레이어의 할 일 완료 시 NotFoundException을 던진다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '내 할 일');

      // When & Then
      await expect(
        service.completeTask(task.id, otherPlayer.id),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.completeTask(task.id, otherPlayer.id),
      ).rejects.toThrow(`Task does not belong to player ${otherPlayer.id}`);
    });

    it('존재하지 않는 할 일 완료 시 NotFoundException을 던진다', async () => {
      // When & Then
      await expect(service.completeTask(99999, testPlayer.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uncompleteTask', () => {
    it('완료된 할 일을 미완료로 되돌린다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '완료된 할 일');
      task.completedAt = new Date();
      await taskRepository.save(task);

      // When
      const result = await service.uncompleteTask(task.id, testPlayer.id);

      // Then
      expect(result.isCompleted).toBe(false);
    });

    it('다른 플레이어의 할 일 미완료 처리 시 NotFoundException을 던진다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '내 할 일');

      // When & Then
      await expect(
        service.uncompleteTask(task.id, otherPlayer.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTask', () => {
    it('할 일 설명을 수정한다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '원래 설명');

      // When
      const result = await service.updateTask(
        task.id,
        '수정된 설명',
        testPlayer.id,
      );

      // Then
      expect(result.description).toBe('수정된 설명');

      // DB에도 반영되었는지 확인
      const updated = await taskRepository.findOne({ where: { id: task.id } });
      expect(updated!.description).toBe('수정된 설명');
    });

    it('다른 플레이어의 할 일 수정 시 NotFoundException을 던진다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '내 할 일');

      // When & Then
      await expect(
        service.updateTask(task.id, '수정', otherPlayer.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('존재하지 않는 할 일 수정 시 NotFoundException을 던진다', async () => {
      // When & Then
      await expect(
        service.updateTask(99999, '수정', testPlayer.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTask', () => {
    it('할 일을 삭제한다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '삭제할 할 일');

      // When
      await service.deleteTask(task.id, testPlayer.id);

      // Then
      const deleted = await taskRepository.findOne({ where: { id: task.id } });
      expect(deleted).toBeNull();
    });

    it('다른 플레이어의 할 일 삭제 시 NotFoundException을 던진다', async () => {
      // Given
      const task = await createTestTask(testPlayer, '내 할 일');

      // When & Then
      await expect(service.deleteTask(task.id, otherPlayer.id)).rejects.toThrow(
        NotFoundException,
      );

      // 삭제되지 않았는지 확인
      const stillExists = await taskRepository.findOne({
        where: { id: task.id },
      });
      expect(stillExists).toBeDefined();
    });

    it('존재하지 않는 할 일 삭제 시 NotFoundException을 던진다', async () => {
      // When & Then
      await expect(service.deleteTask(99999, testPlayer.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
