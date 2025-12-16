import { Test, TestingModule } from '@nestjs/testing';
import { CharacterGateway } from './character.gateway';
import { CharacterService } from './character.service';
import { Socket } from 'socket.io';
import { MoveReq } from './dto/move.dto';

describe('CharacterGateway', () => {
  let gateway: CharacterGateway;

  const emitMock = jest.fn();
  const toMock = jest.fn().mockReturnValue({
    emit: emitMock,
  });

  const clientMock = {
    id: 'socket-123',
    to: toMock,
  } as unknown as Socket;

  const mockCharacterService = {
    startSessionTimer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterGateway,
        {
          provide: CharacterService,
          useValue: mockCharacterService,
        },
      ],
    }).compile();

    gateway = module.get<CharacterGateway>(CharacterGateway);

    jest.clearAllMocks();
  });

  it('move 이벤트를 전송하면 moved 이벤트로 브로드캐스팅 로직이 호출된다', () => {
    const moveReq: MoveReq = {
      roomId: 'room-1',
      direction: 'left',
    };

    gateway.handleMove(moveReq, clientMock);

    expect(toMock).toHaveBeenCalledWith('room-1');
    expect(emitMock).toHaveBeenCalledWith('moved', {
      userId: 'socket-123',
      direction: 'left',
    });
  });
});
