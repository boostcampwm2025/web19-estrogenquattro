import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Player } from '../player/entites/player.entity';
import { Notice } from './entities/notice.entity';
import { NoticeRead } from './entities/notice-read.entity';

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    @InjectRepository(Notice)
    private readonly notificationRepository: Repository<Notice>,
    @InjectRepository(NoticeRead)
    private readonly noticeReadRepository: Repository<NoticeRead>,
  ) {}

  async create(authorId: number, dto: CreateNotificationDto): Promise<Notice> {
    const notification = this.notificationRepository.create({
      titleKo: dto.ko.title,
      contentKo: dto.ko.content,
      titleEn: dto.en.title,
      contentEn: dto.en.content,
      author: { id: authorId } as unknown as Player,
    });
    return this.notificationRepository.save(notification);
  }

  async findByPage(
    pageStr?: string,
    limitStr?: string,
  ): Promise<{
    items: Notice[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    const page = pageStr !== undefined ? Number.parseInt(pageStr, 10) : 1;
    if (pageStr !== undefined && (Number.isNaN(page) || page < 1)) {
      throw new BadRequestException('page는 1 이상의 정수여야 합니다');
    }

    const limit = limitStr !== undefined ? Number.parseInt(limitStr, 10) : 20;
    if (Number.isNaN(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('limit은 1~50 범위의 정수여야 합니다');
    }

    const skip = (page - 1) * limit;

    const [items, totalCount] = await this.notificationRepository
      .createQueryBuilder('notice')
      .leftJoin('notice.author', 'author')
      .addSelect(['author.id', 'author.nickname'])
      .orderBy('notice.id', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      totalCount,
      currentPage: page,
      totalPages,
    };
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

    if (dto.ko) {
      if (dto.ko.title !== undefined) notification.titleKo = dto.ko.title;
      if (dto.ko.content !== undefined) notification.contentKo = dto.ko.content;
    }
    if (dto.en) {
      if (dto.en.title !== undefined) notification.titleEn = dto.en.title;
      if (dto.en.content !== undefined) notification.contentEn = dto.en.content;
    }

    return this.notificationRepository.save(notification);
  }

  async remove(id: number): Promise<void> {
    const result = await this.notificationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  async markAsRead(noticeId: number, playerId: number): Promise<void> {
    const exists = await this.noticeReadRepository.findOne({
      where: {
        notice: { id: noticeId },
        player: { id: playerId },
      },
    });

    if (exists) return;

    const record = this.noticeReadRepository.create({
      notice: { id: noticeId } as Notice,
      player: { id: playerId } as Player,
    });

    await this.noticeReadRepository.save(record);
    this.logger.log('Notice marked as read', { noticeId, playerId });
  }

  async getLatestUnreadNotice(playerId: number): Promise<Notice | null> {
    const latestNotice = await this.notificationRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!latestNotice) {
      return null;
    }

    const isRead = await this.noticeReadRepository.findOne({
      where: {
        notice: { id: latestNotice.id },
        player: { id: playerId },
      },
    });

    if (isRead) {
      return null;
    }

    return latestNotice;
  }
}
