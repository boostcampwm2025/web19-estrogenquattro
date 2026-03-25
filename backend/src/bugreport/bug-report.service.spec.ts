/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BugReportService } from './bug-report.service';
import { BugReport } from './entities/bug-report.entity';
import { PlayerService } from '../player/player.service';

describe('BugReportService', () => {
  const createService = (webhookUrl = 'https://discord.test/webhook') => {
    const bugReportRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<BugReport>;
    const playerService = {
      findOneById: jest.fn(),
    } as unknown as PlayerService;
    const configService = {
      get: jest.fn().mockReturnValue(webhookUrl),
    } as unknown as ConfigService;

    return {
      service: new BugReportService(
        bugReportRepository,
        playerService,
        configService,
      ),
      bugReportRepository,
      playerService,
    };
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
  });

  it('내용을 저장하고 작성자 요약을 반환한다', async () => {
    const { service, bugReportRepository, playerService } = createService();
    const player = { id: 1, nickname: 'alice' };
    const created = { id: 7, content: '버그', diagnostics: '{}', player };

    (playerService.findOneById as jest.Mock).mockResolvedValue(player);
    (bugReportRepository.create as jest.Mock).mockReturnValue(created);
    (bugReportRepository.save as jest.Mock).mockResolvedValue(created);

    const sendSpy = jest
      .spyOn(
        service as unknown as { sendToDiscord: () => Promise<void> },
        'sendToDiscord',
      )
      .mockResolvedValue(undefined);

    const result = await service.create(1, {
      content: '버그',
      diagnostics: '{}',
    });

    expect(result.player).toEqual({ id: 1, nickname: 'alice' });
    expect(sendSpy).toHaveBeenCalled();
  });

  it('내용 길이와 이미지 크기를 검증한다', async () => {
    const { service } = createService();

    await expect(
      service.create(1, { content: '', diagnostics: '' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(1, { content: 'a'.repeat(501), diagnostics: '' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(1, { content: 'ok', diagnostics: '' }, [
        {
          buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
          originalname: 'big.png',
          mimetype: 'image/png',
        },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('웹훅 URL이 없으면 Discord 전송을 건너뛴다', async () => {
    const { service } = createService('');

    await expect(
      (
        service as unknown as {
          sendToDiscord: (...args: unknown[]) => Promise<void>;
        }
      ).sendToDiscord('alice', '버그', '{"ok":true}'),
    ).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('이미지가 없으면 JSON payload로 전송한다', async () => {
    const { service } = createService();

    await (
      service as unknown as {
        sendToDiscord: (...args: unknown[]) => Promise<void>;
      }
    ).sendToDiscord('alice', '버그', '{"ok":true}');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.test/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('이미지가 있으면 multipart form-data로 전송한다', async () => {
    const { service } = createService();

    await (
      service as unknown as {
        sendToDiscord: (...args: unknown[]) => Promise<void>;
      }
    ).sendToDiscord('alice', '버그', undefined, [
      {
        buffer: Buffer.from('img'),
        originalname: 'a.png',
        mimetype: 'image/png',
      },
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.test/webhook',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
  });
});
