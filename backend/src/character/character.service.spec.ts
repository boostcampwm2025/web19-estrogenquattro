import { CharacterService } from './character.service';

describe('CharacterService', () => {
  let service: CharacterService;

  beforeEach(() => {
    service = new CharacterService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1분마다 onMinute 콜백이 호출된다', () => {
    //given
    const socketId = 'socket-1';
    const onMinute = jest.fn();

    //when
    service.startSessionTimer(socketId, onMinute);

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
    const onMinute = jest.fn();

    //when
    service.startSessionTimer(socketId, onMinute);
    service.startSessionTimer(socketId, onMinute);
    jest.advanceTimersByTime(60_000);

    //then
    expect(onMinute).toHaveBeenCalledTimes(1);
  });

  it('여러 socketId는 각각 독립적인 타이머를 가질 수 있다.', () => {
    //given
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    //when
    service.startSessionTimer('socket-1', cb1);
    service.startSessionTimer('socket-2', cb2);
    jest.advanceTimersByTime(60_000);

    //then
    expect(cb1).toHaveBeenCalledWith(1);
    expect(cb2).toHaveBeenCalledWith(1);
  });

  it('stopSessionTimer는 타이머를 정리하고 콜백 호출을 중단한다', () => {
    //given
    const socketId = 'socket-3';
    const onMinute = jest.fn();

    //when
    service.startSessionTimer(socketId, onMinute);
    jest.advanceTimersByTime(60_000);
    service.stopSessionTimer(socketId);
    jest.advanceTimersByTime(60_000);

    //then
    expect(onMinute).toHaveBeenCalledTimes(1);
  });
});
