import { Repository } from 'typeorm';
import { WriteLockService } from '../database/write-lock.service';
import { Player } from '../player/entites/player.entity';
import { ChatHistory } from './entities/chat-history.entity';
import { ChatHistoryService } from './chat-history.service';

describe('ChatHistoryService', () => {
  const createService = () => {
    const chatHistoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<ChatHistory>;
    const writeLockService = {
      runExclusive: jest.fn(async (task: () => Promise<unknown>) => task()),
    } as unknown as WriteLockService;

    return {
      service: new ChatHistoryService(chatHistoryRepository, writeLockService),
      chatHistoryRepository,
      writeLockService,
    };
  };

  it('runExclusive 안에서 전달받은 닉네임으로 채팅 이력을 저장한다', async () => {
    const { service, chatHistoryRepository, writeLockService } =
      createService();
    const player = { id: 7, nickname: 'alice' };
    const created = {
      id: 1,
      roomId: 'room-1',
      nickname: 'alice',
      message: 'hello',
      player,
      createdAt: new Date(),
    };

    (chatHistoryRepository.create as jest.Mock).mockReturnValue(created);
    (chatHistoryRepository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.create(7, 'room-1', 'alice', 'hello');

    expect(writeLockService.runExclusive).toHaveBeenCalledTimes(1);
    expect(chatHistoryRepository.create).toHaveBeenCalledWith({
      roomId: 'room-1',
      nickname: 'alice',
      message: 'hello',
      player: { id: 7 } as Player,
    });
    expect(chatHistoryRepository.save).toHaveBeenCalledWith(created);
    expect(result).toBe(created);
  });
});
