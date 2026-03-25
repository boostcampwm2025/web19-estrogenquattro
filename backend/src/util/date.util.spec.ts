import {
  getTodayKstDateString,
  getTodayKstRangeUtc,
  getYesterdayKstRange,
} from './date.util';

describe('date.util', () => {
  it('주어진 기준 시각으로 오늘 KST 날짜 문자열을 만든다', () => {
    const base = new Date('2026-03-18T03:00:00.000Z');

    expect(getTodayKstDateString(base)).toBe('2026-03-18');
  });

  it('주어진 기준 시각으로 오늘 KST 범위를 UTC로 반환한다', () => {
    const base = new Date('2026-03-18T03:00:00.000Z');

    const { start, end } = getTodayKstRangeUtc(base);

    expect(start.toISOString()).toBe('2026-03-17T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-18T14:59:59.999Z');
  });

  it('어제 KST 범위를 반환한다', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-18T10:00:00.000Z'));

    const { start, end } = getYesterdayKstRange();

    expect(start.toISOString()).toBe('2026-03-17T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-18T14:59:59.999Z');

    jest.useRealTimers();
  });
});
