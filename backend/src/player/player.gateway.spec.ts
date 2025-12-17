import { Test, TestingModule } from '@nestjs/testing';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { Socket } from 'socket.io';
import { MoveReq } from './dto/move.dto';

describe('PlayerGateway', () => {
  let gateway: PlayerGateway;

  const emitMock = jest.fn();
  const toMock = jest.fn().mockReturnValue({
    emit: emitMock,
  });

  const clientMock = {
    id: 'socket-123',
    to: toMock,
  } as unknown as Socket;

  const mockPlayTimeService = {
    startTimer: jest.fn(),
    stopTimer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerGateway,
        {
          provide: PlayTimeService,
          useValue: mockPlayTimeService,
        },
      ],
    }).compile();

    gateway = module.get<PlayerGateway>(PlayerGateway);

    jest.clearAllMocks();
  });

  it('move 이벤트를 전송하면 moved 이벤트로 브로드캐스팅 로직이 호출된다', () => {
    const moveReq: MoveReq = {
      userId: clientMock.id,
      roomId: 'room-1',
      x: 125.23113,
      y: 24.11231,
      isMoving: true,
      direction: 'left',
      timestamp: 123,
    };

    gateway.handleMove(moveReq, clientMock);

    expect(toMock).toHaveBeenCalledWith('room-1');
    expect(emitMock).toHaveBeenCalledWith('moved', {
      userId: clientMock.id,
      roomId: 'room-1',
      x: 125.23113,
      y: 24.11231,
      isMoving: true,
      direction: 'left',
      timestamp: 123,
    });
  });
});
