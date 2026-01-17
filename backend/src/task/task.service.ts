import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entites/task.entity';
import { CreateTaskReq } from './dto/create-task.req.dto';
import { PlayerService } from '../player/player.service';
import { TaskRes } from './dto/task.res.dto';
import { TaskListRes } from './dto/task-list.res.dto';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class TaskService {
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
      createdDate: new Date(),
    });

    const savedTask = await this.taskRepository.save(newTask);

    return TaskRes.of(savedTask);
  }

  async getTasks(playerId: number, date?: string): Promise<TaskListRes> {
    await this.playerService.findOneById(playerId);

    const today = new Date().toISOString().slice(0, 10);
    const targetDate = date ?? today;
    const isToday = targetDate === today;

    const query = this.taskRepository
      .createQueryBuilder('task')
      .where('task.player.id = :playerId', { playerId })
      .andWhere('task.createdDate = :targetDate', { targetDate });

    if (isToday) {
      query.andWhere(
        '(task.completedDate IS NULL OR task.completedDate = :today)',
        { today },
      );
    }

    const tasks = await query.getMany();

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

    task.completedDate = new Date();
    const saved = await this.taskRepository.save(task);
    return TaskRes.of(saved);
  }

  async uncompleteTask(taskId: number, playerId: number): Promise<TaskRes> {
    const task = await this.findOneById(taskId);

    if (task.player.id !== playerId) {
      throw new NotFoundException(`Task does not belong to player ${playerId}`);
    }

    task.completedDate = null;
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
    return TaskRes.of(saved);
  }

  async deleteTask(taskId: number, playerId: number): Promise<void> {
    const task = await this.findOneById(taskId);

    if (task.player.id !== playerId) {
      throw new NotFoundException(`Task does not belong to player ${playerId}`);
    }

    await this.taskRepository.remove(task);
  }
}
