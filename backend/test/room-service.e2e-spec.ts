import {
  RoomFullException,
  RoomNotFoundException,
} from '../src/room/exceptions/room.exception';
import { RoomService } from '../src/room/room.service';

describe('RoomService integration branches', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('존재하지 않는 방 예약과 입장은 예외를 던진다', () => {
    const service = new RoomService();

    expect(() => service.reserveRoom(1, 'missing-room')).toThrow(
      RoomNotFoundException,
    );
    expect(() => service.joinRoom('socket-1', 'missing-room', 1)).toThrow(
      RoomNotFoundException,
    );
  });

  it('같은 소켓이 다시 randomJoin 하면 기존 방을 그대로 반환한다', () => {
    const service = new RoomService();

    const firstRoomId = service.randomJoin('socket-1');
    const secondRoomId = service.randomJoin('socket-1');

    expect(secondRoomId).toBe(firstRoomId);
    expect(service.getRoomIdBySocketId('socket-1')).toBe(firstRoomId);
  });

  it('모든 방이 가득 차면 randomJoin 이 RoomFullException을 던진다', () => {
    const service = new RoomService();

    for (let i = 0; i < 14 * 5; i += 1) {
      service.randomJoin(`socket-${i}`);
    }

    expect(() => service.randomJoin('socket-overflow')).toThrow(
      RoomFullException,
    );
  });

  it('기존 소켓의 joinRoom 재호출은 현재 방을 그대로 반환한다', () => {
    const service = new RoomService();
    const roomId = service.randomJoin('socket-1');

    expect(service.joinRoom('socket-1', 'room-3', 1)).toBe(roomId);
  });

  it('destroy 시 예약 타이머를 정리해서 만료 callback이 더 이상 실행되지 않는다', () => {
    jest.useFakeTimers();
    const service = new RoomService();

    service.reserveRoom(1, 'room-1');
    service.onModuleDestroy();
    jest.advanceTimersByTime(30000);

    expect(service.getAllRooms()['room-1'].size).toBe(1);
  });

  it('플레이어 추가/삭제와 전체 방 정보 조회가 동작한다', () => {
    const service = new RoomService();

    service.addPlayer('room-1', 100);
    service.addPlayer('room-1', 200);
    service.removePlayer('room-1', 100);

    expect(service.getPlayerIds('room-1')).toEqual([200]);
    expect(service.getPlayerIds('missing-room')).toEqual([]);
    expect(service.getAllRooms()['room-1']).toMatchObject({
      id: 'room-1',
      capacity: 14,
      size: 0,
    });
  });
});
