import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Task } from './entites/task.entity';
import { CreateTaskReq } from './dto/create-task.req';
import { PlayerService } from '../player/player.service';
import { TaskRes } from './dto/task.res';
import { TaskListRes } from './dto/task-list.res';
import {
  TaskNotFoundException,
  TaskNotOwnedException,
  TaskFocusingException,
} from './exceptions/task.exceptions';
import { HistoryRank } from '../pointhistory/point-history.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly playerService: PlayerService,
    private readonly dataSource: DataSource,
  ) {}

  async createTask(dto: CreateTaskReq): Promise<TaskRes> {
    const player = await this.playerService.findOneById(dto.playerId);

    const newTask = this.taskRepository.create({
      player,
      description: dto.description,
      createdAt: new Date(),
    });

    const savedTask = await this.taskRepository.save(newTask);
    this.logger.log('Task created', {
      method: 'createTask',
      taskId: savedTask.id,
      playerId: player.id,
    });

    return TaskRes.of(savedTask);
  }

  async getTasks(
    playerId: number,
    isToday: boolean,
    startAt: Date,
    endAt: Date,
  ): Promise<TaskListRes> {
    await this.playerService.findOneById(playerId);

    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .where('task.player.id = :playerId', { playerId });

    if (isToday) {
      queryBuilder.andWhere(
        '(task.completedAt IS NULL OR task.completedAt BETWEEN :startAt AND :endAt)',
        { startAt, endAt },
      );
    } else {
      queryBuilder
        .andWhere('task.createdAt BETWEEN :startAt AND :endAt', {
          startAt,
          endAt,
        })
        .andWhere('task.completedAt IS NOT NULL');
    }

    const tasks = await queryBuilder.getMany();

    return {
      tasks: tasks.map((task) => TaskRes.of(task)),
    };
  }

  async findOneById(id: number): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['player'],
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async completeTask(taskId: number, playerId: number): Promise<TaskRes> {
    const task = await this.findOneById(taskId);

    if (task.player.id !== playerId) {
      throw new NotFoundException(`Task does not belong to player ${playerId}`);
    }

    task.completedAt = new Date();
    task.createdAt = new Date();
    const saved = await this.taskRepository.save(task);
    return TaskRes.of(saved);
  }

  async uncompleteTask(taskId: number, playerId: number): Promise<TaskRes> {
    const task = await this.findOneById(taskId);

    if (task.player.id !== playerId) {
      throw new NotFoundException(`Task does not belong to player ${playerId}`);
    }

    task.completedAt = null;
    task.createdAt = new Date();
    const saved = await this.taskRepository.save(task);
    return TaskRes.of(saved);
  }

  async updateTask(
    taskId: number,
    description: string,
    playerId: number,
  ): Promise<TaskRes> {
    const task = await this.findOneById(taskId);

    if (task.player.id !== playerId) {
      throw new NotFoundException(`Task does not belong to player ${playerId}`);
    }

    task.description = description;
    const saved = await this.taskRepository.save(task);
    this.logger.log('Task updated', {
      method: 'updateTask',
      taskId,
      playerId,
    });
    return TaskRes.of(saved);
  }

  async deleteTask(taskId: number, playerId: number): Promise<void> {
    // 트랜잭션으로 race condition 방지
    await this.dataSource.transaction(async (manager) => {
      // 1. Task 존재 확인
      const task = await manager.findOne(Task, {
        where: { id: taskId },
        relations: ['player'],
      });
      if (!task) {
        throw new TaskNotFoundException();
      }

      // 2. 소유권 확인
      if (task.player.id !== playerId) {
        throw new TaskNotOwnedException();
      }

      // 3. 집중 중인 Task면 삭제 차단 (relations로 로드된 player 사용)
      if (task.player.focusingTaskId === taskId) {
        throw new TaskFocusingException();
      }

      await manager.remove(Task, task);
      this.logger.log('Task deleted', {
        method: 'deleteTask',
        taskId,
        playerId,
      });
    });
  }

  async getTaskRanks(weekendStartAt: Date): Promise<HistoryRank[]> {
    const weekendEndAt = new Date(weekendStartAt);
    weekendEndAt.setDate(weekendEndAt.getDate() + 7);

    const results = await this.taskRepository
      .createQueryBuilder('task')
      .select('task.player_id', 'playerId')
      .addSelect('player.nickname', 'nickname')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('task.player', 'player')
      .where('task.completedAt >= :startAt AND task.completedAt < :endAt', {
        startAt: weekendStartAt,
        endAt: weekendEndAt,
      })
      .groupBy('task.player_id')
      .orderBy('count', 'DESC')
      .getRawMany();

    // 동점자 처리
    let currentRank = 1;
    let previousCount: number | null = null;

    return results.map(
      (row: { playerId: number; nickname: string; count: string }, index) => {
        const count = Number(row.count);

        if (previousCount !== null && count < previousCount) {
          currentRank = index + 1;
        }
        previousCount = count;

        return {
          playerId: row.playerId,
          nickname: row.nickname,
          count,
          rank: currentRank,
        };
      },
    );
  }
}
