import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Player } from '../player/entites/player.entity';
import { Notice } from './entities/notice.entity';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(Notice)
    private readonly notificationRepository: Repository<Notice>,
  ) {}

  async create(
    authorId: number,
    dto: CreateNotificationDto,
  ): Promise<Notice> {
    const notification = this.notificationRepository.create({
      ...dto,
      author: { id: authorId } as unknown as Player,
    });
    return this.notificationRepository.save(notification);
  }

  async findAll(): Promise<Notice[]> {
    return this.notificationRepository.find({
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Notice> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    return notification;
  }

  async update(id: number, dto: UpdateNotificationDto): Promise<Notice> {
    const notification = await this.findOne(id);
    Object.assign(notification, dto);
    return this.notificationRepository.save(notification);
  }

  async remove(id: number): Promise<void> {
    const result = await this.notificationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }
}
