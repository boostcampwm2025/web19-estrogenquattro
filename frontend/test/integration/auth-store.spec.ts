import { beforeEach, describe, expect, it, vi } from "vitest";

const authSuccessSpy = vi.fn();
const authFailedSpy = vi.fn();
const devLoggerErrorSpy = vi.fn();

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    authSuccess: authSuccessSpy,
    authFailed: authFailedSpy,
  },
}));

vi.mock("@/lib/devLogger", () => ({
  devLogger: {
    error: devLoggerErrorSpy,
  },
}));

const createWindowMock = () => ({
  location: { href: "" },
});

describe("authStore 통합", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("window", createWindowMock());
  });

  it("fetchUser 성공 시 사용자 정보와 인증 상태를 저장한다", async () => {
    // Given
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          githubId: "gh-1",
          username: "alice",
          avatarUrl: "https://example.com/alice.png",
          playerId: 1,
        }),
      }),
    );
    vi.resetModules();

    // When
    const { useAuthStore } = await import("@/stores/authStore");
    await useAuthStore.getState().fetchUser();

    // Then
    const state = useAuthStore.getState();
    expect(state.user?.username).toBe("alice");
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(authSuccessSpy).toHaveBeenCalled();
  });

  it("fetchUser가 401이면 인증 실패 상태로 전환한다", async () => {
    // Given
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );
    vi.resetModules();

    // When
    const { useAuthStore } = await import("@/stores/authStore");
    await useAuthStore.getState().fetchUser();

    // Then
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(authFailedSpy).toHaveBeenCalledWith("http_401");
  });

  it("fetchUser 네트워크 실패 시 에러를 기록하고 인증 실패 상태로 전환한다", async () => {
    // Given
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    vi.resetModules();

    // When
    const { useAuthStore } = await import("@/stores/authStore");
    await useAuthStore.getState().fetchUser();

    // Then
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(devLoggerErrorSpy).toHaveBeenCalled();
    expect(authFailedSpy).toHaveBeenCalledWith("network_error");
  });

  it("logout 호출 시 백엔드 로그아웃 URL로 이동한다", async () => {
    // Given
    vi.resetModules();

    // When
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().logout();

    // Then
    expect((window as Window & { location: { href: string } }).location.href).toBe(
      "http://localhost/auth/logout",
    );
  });
});
