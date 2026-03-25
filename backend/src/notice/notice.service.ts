import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNoticeDto } from './dto/create-notification.dto';
import { UpdateNoticeDto } from './dto/update-notification.dto';
import { Player } from '../player/entites/player.entity';
import { Notice } from './entities/notice.entity';
import { NoticeRead } from './entities/notice-read.entity';
import { WriteLockService } from '../database/write-lock.service';

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
    @InjectRepository(NoticeRead)
    private readonly noticeReadRepository: Repository<NoticeRead>,
    private readonly writeLockService: WriteLockService,
  ) {}

  async create(authorId: number, dto: CreateNoticeDto): Promise<Notice> {
    const notice = this.noticeRepository.create({
      titleKo: dto.ko.title,
      contentKo: dto.ko.content,
      titleEn: dto.en.title,
      contentEn: dto.en.content,
      author: { id: authorId } as unknown as Player,
    });
    return this.noticeRepository.save(notice);
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

    const [items, totalCount] = await this.noticeRepository.findAndCount({
      relations: ['author'],
      select: {
        id: true,
        titleKo: true,
        contentKo: true,
        titleEn: true,
        contentEn: true,
        createdAt: true,
        updatedAt: true,
        author: {
          nickname: true,
        },
      },
      order: { id: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      totalCount,
      currentPage: page,
      totalPages,
    };
  }

  async findOne(id: number): Promise<Notice> {
    const notice = await this.noticeRepository.findOne({
      where: { id },
      relations: ['author'],
      select: {
        id: true,
        titleKo: true,
        contentKo: true,
        titleEn: true,
        contentEn: true,
        createdAt: true,
        updatedAt: true,
        author: {
          nickname: true,
        },
      },
    });
    if (!notice) {
      throw new NotFoundException(`Notice with ID ${id} not found`);
    }
    return notice;
  }

  async update(id: number, dto: UpdateNoticeDto): Promise<Notice> {
    const notice = await this.findOne(id);

    if (dto.ko) {
      if (dto.ko.title !== undefined) notice.titleKo = dto.ko.title;
      if (dto.ko.content !== undefined) notice.contentKo = dto.ko.content;
    }
    if (dto.en) {
      if (dto.en.title !== undefined) notice.titleEn = dto.en.title;
      if (dto.en.content !== undefined) notice.contentEn = dto.en.content;
    }

    return this.noticeRepository.save(notice);
  }

  async remove(id: number): Promise<void> {
    const result = await this.noticeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Notice with ID ${id} not found`);
    }
  }

  async markAsRead(noticeId: number, playerId: number): Promise<void> {
    await this.findOne(noticeId);

    await this.writeLockService.runExclusive(async () => {
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
    });

    this.logger.log('Notice marked as read', { noticeId, playerId });
  }

  async getLatestUnreadNotice(playerId: number): Promise<Notice | null> {
    const latestNotice = await this.noticeRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
      relations: ['author'],
      select: {
        id: true,
        titleKo: true,
        contentKo: true,
        titleEn: true,
        contentEn: true,
        createdAt: true,
        updatedAt: true,
        author: {
          nickname: true,
        },
      },
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
