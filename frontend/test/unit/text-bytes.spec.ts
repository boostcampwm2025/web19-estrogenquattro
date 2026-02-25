import { describe, expect, it } from "vitest";
import {
  MAX_FOCUS_TASK_NAME_LENGTH,
  getUtf8ByteLength,
  normalizeFocusTaskName,
  truncateToUtf8Bytes,
} from "@/utils/textBytes";

describe("textBytes 유틸", () => {
  it("TextEncoder 기반 바이트 계산은 Buffer.byteLength와 동일하다", () => {
    const samples = ["hello", "가나다", "a가b나", "🙂emoji", "혼합 text 123"];

    samples.forEach((sample) => {
      expect(getUtf8ByteLength(sample)).toBe(Buffer.byteLength(sample, "utf8"));
    });
  });

  it("truncateToUtf8Bytes는 UTF-8 경계를 깨지 않고 자른다", () => {
    const value = "가나다라마바사"; // 21bytes
    const truncated = truncateToUtf8Bytes(value, 10);

    expect(getUtf8ByteLength(truncated)).toBeLessThanOrEqual(10);
    expect(truncated).toBe("가나다");
  });

  it("normalizeFocusTaskName은 공백 제거 후 45bytes로 정규화한다", () => {
    const normalized = normalizeFocusTaskName(`  ${"가".repeat(20)}  `);

    expect(normalized).toBe("가".repeat(15));
    expect(getUtf8ByteLength(normalized ?? "")).toBe(
      MAX_FOCUS_TASK_NAME_LENGTH,
    );
    expect(normalizeFocusTaskName("   ")).toBeUndefined();
  });
});
