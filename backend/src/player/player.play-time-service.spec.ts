import { PlayTimeService } from './player.play-time-service';

describe('PlayerService', () => {
  let service: PlayTimeService;

  beforeEach(() => {
    service = new PlayTimeService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1분마다 onMinute 콜백이 호출된다', () => {
    //given
    const socketId = 'socket-1';
    const username = 'testuser';
    const onMinute = jest.fn();

    //when
    service.startTimer(socketId, username, onMinute, new Date());

    // then
    jest.advanceTimersByTime(60_000);
    expect(onMinute).toHaveBeenCalledTimes(1);
    expect(onMinute).toHaveBeenCalledWith(1);

    jest.advanceTimersByTime(60_000);
    expect(onMinute).toHaveBeenCalledTimes(2);
    expect(onMinute).toHaveBeenLastCalledWith(2);
  });

  it('같은 socketId로 여러 번 호출해도 타이머는 하나만 생성된다', () => {
    //given
    const socketId = 'socket-2';
    const username = 'testuser';
    const onMinute = jest.fn();

    //when
    service.startTimer(socketId, username, onMinute, new Date());
    service.startTimer(socketId, username, onMinute, new Date());
    jest.advanceTimersByTime(60_000);

    //then
    expect(onMinute).toHaveBeenCalledTimes(1);
  });

  it('여러 socketId는 각각 독립적인 타이머를 가질 수 있다.', () => {
    //given
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    //when
    service.startTimer('socket-1', 'user1', cb1, new Date());
    service.startTimer('socket-2', 'user2', cb2, new Date());
    jest.advanceTimersByTime(60_000);

    //then
    expect(cb1).toHaveBeenCalledWith(1);
    expect(cb2).toHaveBeenCalledWith(1);
  });

  it('stopSessionTimer는 타이머를 정리하고 콜백 호출을 중단한다', () => {
    //given
    const socketId = 'socket-3';
    const username = 'testuser';
    const onMinute = jest.fn();

    //when
    service.startTimer(socketId, username, onMinute, new Date());
    jest.advanceTimersByTime(60_000);
    service.stopTimer(socketId);
    jest.advanceTimersByTime(60_000);

    //then
    expect(onMinute).toHaveBeenCalledTimes(1);
  });
});
