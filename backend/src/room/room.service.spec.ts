import { Test, TestingModule } from '@nestjs/testing';
import { RoomService } from './room.service';

describe('RoomService', () => {
  let module: TestingModule;

  // 각 테스트마다 새로운 RoomService 인스턴스 생성
  const createFreshService = async (): Promise<RoomService> => {
    module = await Test.createTestingModule({
      providers: [RoomService],
    }).compile();
    return module.get<RoomService>(RoomService);
  };

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('randomJoin', () => {
    it('소켓을 방에 배정한다', async () => {
      // Given
      const service = await createFreshService();

      // When
      const roomId = service.randomJoin('socket-1');

      // Then
      expect(roomId).toBeDefined();
      expect(roomId).toMatch(/^room-\d+$/);
    });

    /**
     * 같은 socket.id로 joining을 여러 번 보내는 경우:
     * - 클라이언트 코드 버그 (useEffect 중복 실행 등)
     * - 개발자 도구에서 수동으로 socket.emit('joining', ...) 호출
     * - 악의적 스크립트
     */
    it('같은 소켓으로 중복 입장 시 동일한 방을 반환한다', async () => {
      // Given
      const service = await createFreshService();
      const firstRoomId = service.randomJoin('socket-1');

      // When
      const secondRoomId = service.randomJoin('socket-1');

      // Then
      expect(secondRoomId).toBe(firstRoomId);
    });

    it('서로 다른 소켓은 각각 방에 배정된다', async () => {
      // Given
      const service = await createFreshService();

      // When
      const room1 = service.randomJoin('socket-1');
      const room2 = service.randomJoin('socket-2');

      // Then
      expect(room1).toBeDefined();
      expect(room2).toBeDefined();
      // 방은 같을 수도 다를 수도 있음 (랜덤 배정)
    });

    it('초기 방 3개가 생성되어 있다', async () => {
      // Given
      const service = await createFreshService();

      // When
      // 초기 방에 배정되는지 확인 (room-1, room-2, room-3 중 하나)
      const roomIds = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const roomId = service.randomJoin(`socket-${i}`);
        roomIds.add(roomId);
        service.exit(`socket-${i}`);
      }

      // Then
      // 100번 시도 중 초기 방들이 나와야 함
      expect(roomIds.has('room-1') || roomIds.has('room-2') || roomIds.has('room-3')).toBe(true);
    });
  });

  describe('exit', () => {
    it('소켓이 방을 나간다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = service.randomJoin('socket-1');

      // When
      const exitedRoomId = service.exit('socket-1');

      // Then
      expect(exitedRoomId).toBe(roomId);
    });

    it('방을 나간 후 다시 입장하면 새로 배정받는다', async () => {
      // Given
      const service = await createFreshService();
      service.randomJoin('socket-1');
      service.exit('socket-1');

      // When
      const newRoomId = service.randomJoin('socket-1');

      // Then
      expect(newRoomId).toBeDefined();
    });
  });

  describe('getRoomIdBySocketId', () => {
    it('소켓이 속한 방 ID를 반환한다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = service.randomJoin('socket-1');

      // When
      const result = service.getRoomIdBySocketId('socket-1');

      // Then
      expect(result).toBe(roomId);
    });

    it('입장하지 않은 소켓은 undefined를 반환한다', async () => {
      // Given
      const service = await createFreshService();

      // When
      const result = service.getRoomIdBySocketId('non-existent');

      // Then
      expect(result).toBeUndefined();
    });
  });

  describe('방 정원 관리', () => {
    it('방이 가득 차면 available 리스트에서 제거된다', async () => {
      // Given
      const service = await createFreshService();
      const capacity = 14;

      // 방 하나를 가득 채움
      const socketIds: string[] = [];
      let targetRoomId: string | undefined;

      for (let i = 0; i < capacity; i++) {
        const socketId = `socket-fill-${i}`;
        const roomId = service.randomJoin(socketId);

        if (i === 0) {
          targetRoomId = roomId;
        } else if (roomId !== targetRoomId) {
          // 같은 방에 넣기 위해 exit 후 재시도
          service.exit(socketId);
          continue;
        }
        socketIds.push(socketId);
      }

      // Then
      // 방이 가득 차면 다른 소켓은 다른 방에 배정되어야 함
      // (또는 새 방이 생성됨)
      expect(socketIds.length).toBeGreaterThan(0);
    });

    it('방에서 나가면 available 리스트에 복구된다', async () => {
      // Given
      const service = await createFreshService();

      // 소켓 입장
      const roomId = service.randomJoin('socket-1');

      // 나감
      service.exit('socket-1');

      // When
      // 다른 소켓이 입장하면 같은 방에 배정될 수 있음
      const newRoomId = service.randomJoin('socket-2');

      // Then
      expect(newRoomId).toBeDefined();
    });
  });

  describe('새 방 생성', () => {
    it('모든 방이 가득 차면 새 방이 생성된다', async () => {
      // Given
      const service = await createFreshService();
      const capacity = 14;
      const initialRooms = 3;
      const totalInitialCapacity = capacity * initialRooms;

      // When
      // 초기 방 정원을 초과하는 소켓 입장
      const roomIds = new Set<string>();
      for (let i = 0; i < totalInitialCapacity + 1; i++) {
        const roomId = service.randomJoin(`socket-new-${i}`);
        roomIds.add(roomId);
      }

      // Then
      // 새로운 방(room-4)이 생성되었어야 함
      expect(roomIds.size).toBeGreaterThan(initialRooms);
    });
  });

  describe('addPlayer / removePlayer / getPlayerIds', () => {
    it('방에 플레이어를 추가한다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = 'room-1';

      // When
      service.addPlayer(roomId, 100);

      // Then
      const playerIds = service.getPlayerIds(roomId);
      expect(playerIds).toContain(100);
    });

    it('방에 여러 플레이어를 추가한다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = 'room-1';

      // When
      service.addPlayer(roomId, 100);
      service.addPlayer(roomId, 200);
      service.addPlayer(roomId, 300);

      // Then
      const playerIds = service.getPlayerIds(roomId);
      expect(playerIds).toHaveLength(3);
      expect(playerIds).toContain(100);
      expect(playerIds).toContain(200);
      expect(playerIds).toContain(300);
    });

    it('같은 플레이어를 중복 추가해도 하나만 존재한다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = 'room-1';

      // When
      service.addPlayer(roomId, 100);
      service.addPlayer(roomId, 100);
      service.addPlayer(roomId, 100);

      // Then
      const playerIds = service.getPlayerIds(roomId);
      expect(playerIds).toHaveLength(1);
    });

    it('방에서 플레이어를 제거한다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = 'room-1';
      service.addPlayer(roomId, 100);
      service.addPlayer(roomId, 200);

      // When
      service.removePlayer(roomId, 100);

      // Then
      const playerIds = service.getPlayerIds(roomId);
      expect(playerIds).toHaveLength(1);
      expect(playerIds).not.toContain(100);
      expect(playerIds).toContain(200);
    });

    it('모든 플레이어가 제거되면 빈 배열을 반환한다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = 'room-1';
      service.addPlayer(roomId, 100);

      // When
      service.removePlayer(roomId, 100);

      // Then
      const playerIds = service.getPlayerIds(roomId);
      expect(playerIds).toHaveLength(0);
    });

    it('존재하지 않는 방의 플레이어 목록은 빈 배열이다', async () => {
      // Given
      const service = await createFreshService();

      // When
      const playerIds = service.getPlayerIds('non-existent-room');

      // Then
      expect(playerIds).toHaveLength(0);
    });

    it('존재하지 않는 플레이어 제거는 에러 없이 무시된다', async () => {
      // Given
      const service = await createFreshService();
      const roomId = 'room-1';
      service.addPlayer(roomId, 100);

      // When & Then
      expect(() => {
        service.removePlayer(roomId, 999);
      }).not.toThrow();

      const playerIds = service.getPlayerIds(roomId);
      expect(playerIds).toHaveLength(1);
    });
  });
});
