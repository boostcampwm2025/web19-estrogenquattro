import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BugReport } from './entities/bug-report.entity';
import { PlayerService } from '../player/player.service';

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
    content: string,
    images?: UploadedFile[],
  ) {
    const player = await this.playerService.findOneById(playerId);

    const bugReport = this.bugReportRepository.create({
      content,
      player,
    });

    const saved = await this.bugReportRepository.save(bugReport);

    await this.sendToDiscord(player.nickname, content, images);

    return {
      ...saved,
      player: { id: player.id, nickname: player.nickname },
    };
  }

  private async sendToDiscord(
    nickname: string,
    content: string,
    images?: UploadedFile[],
  ): Promise<void> {
    try {
      const payload = {
        embeds: [
          {
            title: '🐛 버그 제보',
            color: 0xff4444,
            fields: [
              { name: '제보자', value: nickname, inline: true },
              { name: '내용', value: content },
            ],
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
}
