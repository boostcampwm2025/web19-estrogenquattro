export const CHAT_MAX_LENGTH = 90;
export const MAX_TASK_TEXT_LENGTH = 300;
export const MAX_FOCUS_TASK_NAME_LENGTH = 45;

const encoder = new TextEncoder();

export function getUtf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

export function exceedsUtf8ByteLimit(text: string, maxBytes: number): boolean {
  return getUtf8ByteLength(text) > maxBytes;
}

export function truncateToUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0 || text.length === 0) {
    return "";
  }

  let result = "";
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

export function normalizeFocusTaskName(
  taskName?: string | null,
): string | undefined {
  if (typeof taskName !== "string") {
    return undefined;
  }

  const trimmed = taskName.trim();
  if (!trimmed) {
    return undefined;
  }

  return truncateToUtf8Bytes(trimmed, MAX_FOCUS_TASK_NAME_LENGTH);
}
