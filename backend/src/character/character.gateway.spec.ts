import { Test, TestingModule } from '@nestjs/testing';
import { CharacterGateway } from './character.gateway';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CharacterGateway],
    }).compile();

    gateway = module.get<CharacterGateway>(CharacterGateway);

    jest.clearAllMocks();
  });

  it('move 이벤트를 전송하면 moved 이벤트로 브로드캐스팅 로직이 호출될 수 있다.', () => {
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
