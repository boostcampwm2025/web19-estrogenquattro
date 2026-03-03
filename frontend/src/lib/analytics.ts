import { sendGAEvent } from "@next/third-parties/google";

const isDev = process.env.NODE_ENV === "development";

/**
 * GA4 이벤트 추적 유틸리티
 * - @next/third-parties/google의 sendGAEvent를 래핑
 * - 개발 환경에서는 콘솔에 디버그 로그 출력
 * - SSR/테스트 환경에서 window가 없으면 안전하게 무시
 */
export const Analytics = {
  event: (eventName: string, params?: Record<string, unknown>) => {
    if (isDev) {
      console.log(`[GA4] ${eventName}`, params ?? "");
    }

    if (typeof window === "undefined") return;

    sendGAEvent("event", eventName, params ?? {});
  },

  /**
   * 유저 속성 설정 (language, member_type 등)
   * dataLayer.push를 사용하여 gtag 로드 전에도 안전하게 큐잉
   */
  setUserProperties: (properties: Record<string, string>) => {
    if (isDev) {
      console.log("[GA4] Set user properties", properties);
    }

    if (typeof window === "undefined") return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(["set", "user_properties", properties]);
  },

  // ── Focus Timer ──

  focusStart: (taskName?: string) => {
    Analytics.event("focus_start", {
      task_name: taskName ?? "(no task)",
    });
  },

  focusStop: (elapsedSeconds: number) => {
    Analytics.event("focus_stop", {
      elapsed_seconds: elapsedSeconds,
      elapsed_minutes: Math.floor(elapsedSeconds / 60),
    });
  },

  // ── Tasks ──

  taskCreate: () => {
    Analytics.event("task_create");
  },

  taskComplete: () => {
    Analytics.event("task_complete");
  },

  taskDelete: () => {
    Analytics.event("task_delete");
  },

  // ── Pet / Gacha ──

  gachaPull: (petGrade: number, isDuplicate: boolean) => {
    Analytics.event("gacha_pull", {
      pet_grade: petGrade,
      is_duplicate: isDuplicate,
    });
  },

  petEquip: (petId: number) => {
    Analytics.event("pet_equip", { pet_id: petId });
  },

  // ── Room ──

  roomJoin: (roomPopulation: number) => {
    Analytics.event("room_join", {
      room_population: roomPopulation,
    });
  },

  // ── Onboarding ──

  tutorialStart: () => {
    Analytics.event("tutorial_start");
  },

  tutorialComplete: () => {
    Analytics.event("tutorial_complete");
  },

  tutorialSkip: (currentStep: number) => {
    Analytics.event("tutorial_skip", { step: currentStep });
  },

  // ── Login Funnel ──

  loginClick: () => {
    Analytics.event("login_click", { method: "github" });
  },

  authCallback: () => {
    Analytics.event("auth_callback");
  },

  authSuccess: () => {
    Analytics.event("auth_success");
  },

  authFailed: (reason: string) => {
    Analytics.event("auth_failed", { reason });
  },

  // ── Operational ──

  roomJoinFailed: (reason: string) => {
    Analytics.event("room_join_failed", { reason });
  },
};
