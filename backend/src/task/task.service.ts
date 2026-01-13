import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull } from 'typeorm';
import { Task } from './entites/task.entity';
import { CreateTaskReq } from './dto/create-task.req.dto';
import { PlayerService } from '../player/player.service';
import { TaskRes } from './dto/task.res.dto';
import { TaskListRes } from './dto/task-list.res.dto';

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
      tasks: tasks.map(TaskRes.of),
    };
  }
}
