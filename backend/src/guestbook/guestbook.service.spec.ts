/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { GuestbookService } from './guestbook.service';
import { Guestbook } from './entities/guestbook.entity';
import { Player } from '../player/entites/player.entity';
import { PlayerService } from '../player/player.service';

describe('GuestbookService', () => {
  const createService = () => {
    const guestbookRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<Guestbook>;
    const playerRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as Repository<Player>;
    const playerService = {
      findOneById: jest.fn(),
    } as unknown as PlayerService;

    return {
      service: new GuestbookService(
        guestbookRepository,
        playerRepository,
        playerService,
      ),
      guestbookRepository,
      playerRepository,
      playerService,
    };
  };

  it('내용을 trim 후 저장하고 작성자 요약을 반환한다', async () => {
    const { service, guestbookRepository, playerService } = createService();
    const player = { id: 1, nickname: 'alice' };
    const created = {
      id: 1,
      content: 'hello',
      player,
      writeDate: '2026-03-18',
    };

    (playerService.findOneById as jest.Mock).mockResolvedValue(player);
    (guestbookRepository.findOne as jest.Mock).mockResolvedValue(null);
    (guestbookRepository.create as jest.Mock).mockReturnValue(created);
    (guestbookRepository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.create(1, '  hello  ');

    expect(guestbookRepository.create).toHaveBeenCalledWith({
      content: 'hello',
      player,
      writeDate: expect.any(String),
    });
    expect(result.player).toEqual({ id: 1, nickname: 'alice' });
  });

  it('내용이 비었거나 200자를 넘으면 예외를 던진다', async () => {
    const { service } = createService();

    await expect(service.create(1, '   ')).rejects.toThrow(BadRequestException);
    await expect(service.create(1, 'a'.repeat(201))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('하루 중복 작성이면 예외를 던진다', async () => {
    const { service, guestbookRepository, playerService } = createService();

    (playerService.findOneById as jest.Mock).mockResolvedValue({
      id: 1,
      nickname: 'alice',
    });
    (guestbookRepository.findOne as jest.Mock).mockResolvedValueOnce({
      id: 99,
    });

    await expect(service.create(1, 'hello')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('UNIQUE 제약 에러를 사용자 친화적인 예외로 바꾼다', async () => {
    const { service, guestbookRepository, playerService } = createService();
    const player = { id: 1, nickname: 'alice' };

    (playerService.findOneById as jest.Mock).mockResolvedValue(player);
    (guestbookRepository.findOne as jest.Mock).mockResolvedValue(null);
    (guestbookRepository.create as jest.Mock).mockReturnValue({
      id: 1,
      content: 'hello',
      player,
      writeDate: '2026-03-18',
    });
    const error = new QueryFailedError('INSERT', [], new Error('UNIQUE'));
    (guestbookRepository.save as jest.Mock).mockRejectedValue(error);

    await expect(service.create(1, 'hello')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('커서 기반 목록 조회 시 nextCursor를 계산한다', async () => {
    const { service, guestbookRepository } = createService();
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 3 }, { id: 2 }, { id: 1 }]),
    };
    (guestbookRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const result = await service.findByCursor(4, 2, 'DESC');

    expect(qb.where).toHaveBeenCalledWith('guestbook.id < :cursor', {
      cursor: 4,
    });
    expect(result.items).toEqual([{ id: 3 }, { id: 2 }]);
    expect(result.nextCursor).toBe(2);
  });

  it('삭제 시 존재 여부와 작성자 일치를 검증한다', async () => {
    const { service, guestbookRepository } = createService();

    (guestbookRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.delete(1, 1)).rejects.toThrow(NotFoundException);

    (guestbookRepository.findOne as jest.Mock).mockResolvedValueOnce({
      id: 1,
      player: { id: 2 },
    });
    await expect(service.delete(1, 1)).rejects.toThrow(ForbiddenException);

    const guestbook = { id: 1, player: { id: 1 } };
    (guestbookRepository.findOne as jest.Mock).mockResolvedValueOnce(guestbook);

    await service.delete(1, 1);

    expect(guestbookRepository.remove).toHaveBeenCalledWith(guestbook);
  });
});
