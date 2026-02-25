export function getUtf8ByteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

export function exceedsUtf8ByteLimit(text: string, maxBytes: number): boolean {
  return getUtf8ByteLength(text) > maxBytes;
}

export function truncateToUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0 || text.length === 0) {
    return '';
  }

  let result = '';
  let currentBytes = 0;

  for (const char of text) {
    const charBytes = getUtf8ByteLength(char);
    if (currentBytes + charBytes > maxBytes) {
      break;
    }
    result += char;
    currentBytes += charBytes;
  }

  return result;
}
