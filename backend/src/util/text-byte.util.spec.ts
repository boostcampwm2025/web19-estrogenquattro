import {
  exceedsUtf8ByteLimit,
  getUtf8ByteLength,
  truncateToUtf8Bytes,
} from './text-byte.util';

describe('text-byte.util', () => {
  it('UTF-8 바이트 길이를 계산한다', () => {
    expect(getUtf8ByteLength('abc')).toBe(3);
    expect(getUtf8ByteLength('가')).toBe(3);
    expect(getUtf8ByteLength('a가')).toBe(4);
  });

  it('바이트 제한 초과 여부를 판단한다', () => {
    expect(exceedsUtf8ByteLimit('hello', 5)).toBe(false);
    expect(exceedsUtf8ByteLimit('안녕', 5)).toBe(true);
  });

  it('바이트 제한에 맞춰 문자열을 자른다', () => {
    expect(truncateToUtf8Bytes('abcdef', 4)).toBe('abcd');
    expect(truncateToUtf8Bytes('가나다', 6)).toBe('가나');
    expect(truncateToUtf8Bytes('a가b', 4)).toBe('a가');
    expect(truncateToUtf8Bytes('hello', 0)).toBe('');
    expect(truncateToUtf8Bytes('', 10)).toBe('');
  });
});
