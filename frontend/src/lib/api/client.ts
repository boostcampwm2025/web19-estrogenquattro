import { devLogger } from "@/lib/devLogger";

// API 기본 URL (개발: localhost:8080, 프로덕션: 상대 경로)
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "");

// 공통 fetch wrapper
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    // DELETE 요청은 빈 응답일 수 있음
    const text = await response.text();

    if (!response.ok) {
      // 401 Unauthorized - 토큰 만료 → 로그인 페이지로 이동
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Unauthorized");
      }

      let errorMessage = `API Error: ${response.status}`;
      if (text) {
        try {
          const data = JSON.parse(text) as {
            message?: unknown;
            error?: unknown;
            detail?: unknown;
          };
          const detailedMessage =
            (data && typeof data === "string" && data) ||
            (data &&
              typeof data === "object" &&
              (data.message ?? data.error ?? data.detail));
          if (detailedMessage) {
            if (Array.isArray(detailedMessage)) {
              errorMessage += ` - ${detailedMessage.join(", ")}`;
            } else if (typeof detailedMessage === "string") {
              errorMessage += ` - ${detailedMessage}`;
            } else {
              errorMessage += ` - ${JSON.stringify(detailedMessage)}`;
            }
          }
        } catch {
          const snippet = text.length > 200 ? `${text.slice(0, 197)}...` : text;
          errorMessage += ` - ${snippet}`;
        }
      }
      throw new Error(errorMessage);
    }

    return text ? JSON.parse(text) : ({} as T);
  } catch (error) {
    devLogger.error("fetchApi failed", {
      endpoint,
      method: options?.method ?? "GET",
      error,
    });
    throw error;
  }
}
