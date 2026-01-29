import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entites/task.entity';
import { CreateTaskReq } from './dto/create-task.req';
import { PlayerService } from '../player/player.service';
import { TaskRes } from './dto/task.res';
import { TaskListRes } from './dto/task-list.res';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly playerService: PlayerService,
  ) {}

  async createTask(dto: CreateTaskReq): Promise<TaskRes> {
    const player = await this.playerService.findOneById(dto.playerId);

    const newTask = this.taskRepository.create({
      player,
      description: dto.description,
      createdAt: new Date(),
    });

    const savedTask = await this.taskRepository.save(newTask);
    this.logger.log(
      `Task created (taskId: ${savedTask.id}, playerId: ${player.id})`,
    );

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
      // isToday = true: completedAt이 null이거나 startAt~endAt 범위
      queryBuilder.andWhere(
        '(task.completedAt IS NULL OR task.completedAt BETWEEN :startAt AND :endAt)',
        { startAt, endAt },
      );
    } else {
      // isToday = false: createdAt이 startAt~endAt 범위이면서 completedAt이 NOT NULL
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
    this.logger.log(`Task updated (taskId: ${taskId}, playerId: ${playerId})`);
    return TaskRes.of(saved);
  }

  async deleteTask(taskId: number, playerId: number): Promise<void> {
    const task = await this.findOneById(taskId);

    if (task.player.id !== playerId) {
      throw new NotFoundException(`Task does not belong to player ${playerId}`);
    }

    await this.taskRepository.remove(task);
    this.logger.log(`Task deleted (taskId: ${taskId}, playerId: ${playerId})`);
  }
}
