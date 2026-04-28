import { Repository } from 'typeorm';
import { Socket } from 'socket.io-client';

import { Player } from '../src/player/entites/player.entity';
import { ChatHistory } from '../src/chat/entities/chat-history.entity';
import {
  TestAppContext,
  createSocketClient,
  createTestApp,
  getRepository,
  joinRoom,
  seedAuthenticatedPlayer,
  waitForNoSocketEvent,
  waitForSocketEvent,
} from './e2e-test-helpers';

describe('Chat E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let chatHistoryRepository: Repository<ChatHistory>;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    context = await createTestApp();
    playerRepository = getRepository(context, Player);
    chatHistoryRepository = getRepository(context, ChatHistory);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    sockets = [];
    await chatHistoryRepository.clear();
    await playerRepository.clear();
  });

  afterEach(() => {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
  });

  const connectAndJoin = async (
    socialId: number,
    username: string,
    roomId: string,
  ): Promise<Socket> => {
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId,
      username,
    });

    const socket = await createSocketClient(context.baseUrl, seeded.cookie);
    sockets.push(socket);

    await joinRoom(socket, {
      x: 100,
      y: 100,
      username,
      roomId,
    });

    return socket;
  };

  it('같은 방 사용자가 chatting을 전송하면 상대 소켓이 chatted를 수신한다', async () => {
    // Given: 같은 방(room-1)에 사용자 두 명이 접속한 상태
    const sender = await connectAndJoin(21001, 'chat-sender', 'room-1');
    const receiver = await connectAndJoin(21002, 'chat-receiver', 'room-1');

    // When: 한 사용자가 chatting 이벤트로 메시지를 전송하면
    const chattedPromise = waitForSocketEvent<{
      userId: string;
      message: string;
    }>(receiver, 'chatted');
    sender.emit('chatting', {
      message: '테스트 메시지',
      nickname: 'chat-sender',
    });

    // Then: 같은 방의 다른 사용자가 chatted 이벤트를 수신한다
    const chatted = await chattedPromise;
    expect(chatted.userId).toBe(sender.id);
    expect(chatted.message).toBe('테스트 메시지');
  });

  it('공백 메시지와 90bytes 초과 메시지는 브로드캐스트되지 않는다', async () => {
    // Given: 같은 방(room-1)에 사용자 두 명이 접속한 상태
    const sender = await connectAndJoin(21003, 'chat-invalid-sender', 'room-1');
    const receiver = await connectAndJoin(
      21004,
      'chat-invalid-receiver',
      'room-1',
    );

    // When: 공백만 있는 메시지를 전송하면
    const noWhitespaceMessage = waitForNoSocketEvent(receiver, 'chatted');
    sender.emit('chatting', {
      message: '   ',
      nickname: 'chat-invalid-sender',
    });
    await noWhitespaceMessage;

    // Then: chatted 이벤트가 수신되지 않는다

    // When: 90bytes를 초과한 메시지를 전송하면
    const noLongMessage = waitForNoSocketEvent(receiver, 'chatted');
    sender.emit('chatting', {
      message: 'a'.repeat(91),
      nickname: 'chat-invalid-sender',
    });
    await noLongMessage;

    // Then: chatted 이벤트가 수신되지 않는다
  });

  it('한글 30자(90bytes)는 허용되고 31자(93bytes)는 브로드캐스트되지 않는다', async () => {
    // Given: 같은 방(room-1)에 사용자 두 명이 접속한 상태
    const sender = await connectAndJoin(21007, 'chat-ko-sender', 'room-1');
    const receiver = await connectAndJoin(21008, 'chat-ko-receiver', 'room-1');

    // When: 한글 30자(90bytes) 메시지를 전송하면
    const validMessage = '가'.repeat(30);
    const chattedPromise = waitForSocketEvent<{ message: string }>(
      receiver,
      'chatted',
    );
    sender.emit('chatting', {
      message: validMessage,
      nickname: 'chat-ko-sender',
    });

    // Then: 브로드캐스트된다
    const chatted = await chattedPromise;
    expect(chatted.message).toBe(validMessage);

    // When: 한글 31자(93bytes)를 전송하면
    const noLongMessage = waitForNoSocketEvent(receiver, 'chatted');
    sender.emit('chatting', {
      message: '가'.repeat(31),
      nickname: 'chat-ko-sender',
    });
    await noLongMessage;

    // Then: 브로드캐스트되지 않는다
  });

  it('다른 방 사용자에게는 chatted 이벤트가 전파되지 않는다', async () => {
    // Given: 송신자와 수신자가 서로 다른 방(room-1, room-2)에 접속한 상태
    const sender = await connectAndJoin(
      21005,
      'chat-isolated-sender',
      'room-1',
    );
    const receiver = await connectAndJoin(
      21006,
      'chat-isolated-receiver',
      'room-2',
    );

    // When: room-1 사용자가 chatting을 전송하면
    const noEventPromise = waitForNoSocketEvent(receiver, 'chatted');
    sender.emit('chatting', {
      message: '같은 방에서만 보여야 함',
      nickname: 'chat-isolated-sender',
    });

    // Then: room-2 사용자는 chatted 이벤트를 수신하지 않는다
    await noEventPromise;
  });
});
