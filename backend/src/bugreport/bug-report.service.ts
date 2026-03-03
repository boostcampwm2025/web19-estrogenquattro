import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BugReport } from './entities/bug-report.entity';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { PlayerService } from '../player/player.service';
import { BadRequestException } from '@nestjs/common';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class BugReportService {
  private readonly logger = new Logger(BugReportService.name);
  private readonly webhookUrl: string;

  constructor(
    @InjectRepository(BugReport)
    private readonly bugReportRepository: Repository<BugReport>,
    private readonly playerService: PlayerService,
    private readonly configService: ConfigService,
  ) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL', '');
  }

  async create(
    playerId: number,
    dto: CreateBugReportDto,
    images?: UploadedFile[],
  ) {
    this.validateImageSize(images);
    const { content, diagnostics } = dto;

    if (!content || content.length > 500) {
      throw new BadRequestException('제보 내용은 1~500자까지 작성 가능합니다');
    }

    const player = await this.playerService.findOneById(playerId);

    const bugReport = this.bugReportRepository.create({
      content,
      diagnostics,
      player,
    });

    const saved = await this.bugReportRepository.save(bugReport);

    await this.sendToDiscord(player.nickname, content, diagnostics, images);

    return {
      ...saved,
      player: { id: player.id, nickname: player.nickname },
    };
  }

  private async sendToDiscord(
    nickname: string,
    content: string,
    diagnostics?: string,
    images?: UploadedFile[],
  ): Promise<void> {
    try {
      const fields = [
        { name: '제보자', value: nickname, inline: true },
        { name: '내용', value: content },
      ];

      if (diagnostics) {
        fields.push({
          name: '진단 정보 (Diagnostics)',
          value: `\`\`\`json\n${diagnostics}\n\`\`\``,
          inline: false,
        });
      }

      const payload = {
        embeds: [
          {
            title: '🐛 버그 제보',
            color: 0xff4444,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      if (images && images.length > 0) {
        const formData = new FormData();
        images.forEach((image, index) => {
          formData.append(
            `files[${index}]`,
            new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }),
            image.originalname,
          );
        });
        formData.append('payload_json', JSON.stringify(payload));

        await fetch(this.webhookUrl, {
          method: 'POST',
          body: formData,
        });
      } else {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      this.logger.error('Discord 웹훅 전송 실패', error);
    }
  }

  private validateImageSize(images?: UploadedFile[]): void {
    if (!images || images.length === 0) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    for (const image of images) {
      if (image.buffer.length > MAX_SIZE) {
        throw new BadRequestException('이미지 1개당 5MB를 넘을 수 없습니다');
      }
    }
  }
}
