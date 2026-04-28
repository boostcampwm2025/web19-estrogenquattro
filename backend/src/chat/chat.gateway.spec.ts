import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { RoomService } from '../room/room.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { Socket } from 'socket.io';
import { CHAT_MAX_LENGTH } from './chat.constants';
import { ChatHistoryService } from './chat-history.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockRoomService: jest.Mocked<Pick<RoomService, 'getRoomIdBySocketId'>>;
  let mockWsJwtGuard: jest.Mocked<Pick<WsJwtGuard, 'verifyAndDisconnect'>>;
  let mockChatHistoryService: jest.Mocked<Pick<ChatHistoryService, 'create'>>;
  let mockSocket: {
    id: string;
    data: { user?: { playerId: number } };
    nsp: { to: jest.Mock<{ emit: jest.Mock }> };
  };
  let mockEmit: jest.Mock;

  beforeEach(async () => {
    mockEmit = jest.fn();
    mockSocket = {
      id: 'socket-1',
      data: {
        user: {
          playerId: 7,
        },
      },
      nsp: {
        to: jest.fn().mockReturnValue({ emit: mockEmit }),
      },
    };

    mockRoomService = {
      getRoomIdBySocketId: jest.fn().mockReturnValue('room-1'),
    };

    mockWsJwtGuard = {
      verifyAndDisconnect: jest.fn().mockReturnValue(true),
    };

    mockChatHistoryService = {
      create: jest.fn().mockResolvedValue({
        id: 1,
        roomId: 'room-1',
        nickname: 'alice',
        message: 'hello',
        player: { id: 7 },
        createdAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: RoomService, useValue: mockRoomService },
        { provide: WsJwtGuard, useValue: mockWsJwtGuard },
        { provide: ChatHistoryService, useValue: mockChatHistoryService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  describe('handleMessage', () => {
    it('90bytes 이하 메시지는 저장 후 브로드캐스트된다', async () => {
      // Given: 90bytes 이하 메시지
      const message = 'a'.repeat(CHAT_MAX_LENGTH);
      const nickname = 'alice';

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname },
        mockSocket as unknown as Socket,
      );

      // Then: chatted 이벤트 브로드캐스트
      expect(mockChatHistoryService.create).toHaveBeenCalledWith(
        7,
        'room-1',
        nickname,
        message,
      );
      expect(mockSocket.nsp.to).toHaveBeenCalledWith('room-1');
      expect(mockEmit).toHaveBeenCalledWith('chatted', {
        id: 1,
        userId: 'socket-1',
        nickname: 'alice',
        message,
        createdAt: expect.any(Date),
      });
    });

    it('90bytes 초과 메시지는 무시된다', async () => {
      // Given: 91bytes 이상 메시지
      const message = 'a'.repeat(CHAT_MAX_LENGTH + 1);

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('한글 30자(90bytes) 메시지는 브로드캐스트된다', async () => {
      // Given: 한글 30자 (UTF-8 90bytes)
      const message = '가'.repeat(30);

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: chatted 이벤트 브로드캐스트
      expect(mockSocket.nsp.to).toHaveBeenCalledWith('room-1');
      expect(mockEmit).toHaveBeenCalledWith('chatted', {
        id: 1,
        userId: 'socket-1',
        nickname: 'alice',
        message,
        createdAt: expect.any(Date),
      });
    });

    it('한글 31자(93bytes) 메시지는 무시된다', async () => {
      // Given: 한글 31자 (UTF-8 93bytes)
      const message = '가'.repeat(31);

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('빈 메시지는 무시된다', async () => {
      // Given: 빈 문자열 메시지
      const message = '';

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('공백만 있는 메시지는 무시된다', async () => {
      // Given: 공백 문자열 메시지 "   "
      const message = '   ';

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: chatted 이벤트 브로드캐스트 안됨
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('data가 undefined이면 무시된다', async () => {
      // Given: undefined payload

      // When: chatting 이벤트 처리
      await gateway.handleMessage(undefined, mockSocket as unknown as Socket);

      // Then: 에러 없이 무시
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('data.message가 숫자이면 무시된다', async () => {
      // Given: { message: 12345 }

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message: 12345, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: 에러 없이 무시
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('data.message가 null이면 무시된다', async () => {
      // Given: { message: null }

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message: null, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: 에러 없이 무시
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('JWT 검증 실패 시 무시된다', async () => {
      // Given: JWT 검증 실패
      mockWsJwtGuard.verifyAndDisconnect.mockReturnValue(false);
      const message = 'hello';

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: 에러 없이 무시
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('방을 찾을 수 없으면 무시된다', async () => {
      // Given: 방 없음
      mockRoomService.getRoomIdBySocketId.mockReturnValue(undefined);
      const message = 'hello';

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: 에러 없이 무시
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('소켓에 user 정보가 없으면 저장하지 않는다', async () => {
      // Given: 인증 정보 누락
      mockSocket.data = {};
      const message = 'hello';

      // When: chatting 이벤트 처리
      await gateway.handleMessage(
        { message, nickname: 'alice' },
        mockSocket as unknown as Socket,
      );

      // Then: 저장/브로드캐스트 안됨
      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('닉네임이 없으면 무시된다', async () => {
      await gateway.handleMessage(
        { message: 'hello', nickname: '   ' },
        mockSocket as unknown as Socket,
      );

      expect(mockChatHistoryService.create).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
