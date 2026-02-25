import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { RoomService } from '../room/room.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { Socket } from 'socket.io';
import { CHAT_MAX_LENGTH } from './chat.constants';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockRoomService: jest.Mocked<Pick<RoomService, 'getRoomIdBySocketId'>>;
  let mockWsJwtGuard: jest.Mocked<Pick<WsJwtGuard, 'verifyAndDisconnect'>>;
  let mockSocket: jest.Mocked<
    Pick<Socket, 'id' | 'to'> & { to: jest.Mock<{ emit: jest.Mock }> }
  >;
  let mockEmit: jest.Mock;

  beforeEach(async () => {
    mockEmit = jest.fn();
    mockSocket = {
      id: 'socket-1',
      to: jest.fn().mockReturnValue({ emit: mockEmit }),
    } as unknown as typeof mockSocket;

    mockRoomService = {
      getRoomIdBySocketId: jest.fn().mockReturnValue('room-1'),
    };

    mockWsJwtGuard = {
      verifyAndDisconnect: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: RoomService, useValue: mockRoomService },
        { provide: WsJwtGuard, useValue: mockWsJwtGuard },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  describe('handleMessage', () => {
    it('30자 이하 메시지는 브로드캐스트된다', () => {
      // Given: 30자 이하 메시지
      const message = 'a'.repeat(CHAT_MAX_LENGTH);

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message }, mockSocket as unknown as Socket);

      // Then: chatted 이벤트 브로드캐스트
      expect(mockSocket.to).toHaveBeenCalledWith('room-1');
      expect(mockEmit).toHaveBeenCalledWith('chatted', {
        userId: 'socket-1',
        message,
      });
    });

    it('30자 초과 메시지는 무시된다', () => {
      // Given: 31자 이상 메시지
      const message = 'a'.repeat(CHAT_MAX_LENGTH + 1);

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message }, mockSocket as unknown as Socket);

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('빈 메시지는 무시된다', () => {
      // Given: 빈 문자열 메시지
      const message = '';

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message }, mockSocket as unknown as Socket);

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('공백만 있는 메시지는 무시된다', () => {
      // Given: 공백 문자열 메시지 "   "
      const message = '   ';

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message }, mockSocket as unknown as Socket);

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('data가 undefined이면 무시된다', () => {
      // Given: undefined payload

      // When: chatting 이벤트 처리
      gateway.handleMessage(undefined, mockSocket as unknown as Socket);

      // Then: 에러 없이 무시
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('data.message가 숫자이면 무시된다', () => {
      // Given: { message: 12345 }

      // When: chatting 이벤트 처리
      gateway.handleMessage(
        { message: 12345 },
        mockSocket as unknown as Socket,
      );

      // Then: 에러 없이 무시
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('data.message가 null이면 무시된다', () => {
      // Given: { message: null }

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message: null }, mockSocket as unknown as Socket);

      // Then: 에러 없이 무시
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('JWT 검증 실패 시 무시된다', () => {
      // Given: JWT 검증 실패
      mockWsJwtGuard.verifyAndDisconnect.mockReturnValue(false);
      const message = 'hello';

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message }, mockSocket as unknown as Socket);

      // Then: 에러 없이 무시
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('방을 찾을 수 없으면 무시된다', () => {
      // Given: 방 없음
      mockRoomService.getRoomIdBySocketId.mockReturnValue(undefined);
      const message = 'hello';

      // When: chatting 이벤트 처리
      gateway.handleMessage({ message }, mockSocket as unknown as Socket);

      // Then: 에러 없이 무시
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
