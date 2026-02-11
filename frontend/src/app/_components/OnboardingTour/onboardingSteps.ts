/** onboarding 네임스페이스에서 사용 가능한 메시지 키 */
export type OnboardingMessageKey =
  | "steps.info.message"
  | "steps.move.message"
  | "steps.chat.message"
  | "steps.progress.message"
  | "steps.channel.message"
  | "steps.leaderboard.message"
  | "steps.character.message"
  | "steps.character.afterModalMessage"
  | "steps.character.subSteps.petTab"
  | "steps.character.subSteps.petGacha"
  | "steps.pet.message"
  | "steps.task.message";

export interface OnboardingStep {
  id: string;
  /** i18n 키 (onboarding 네임스페이스 기준) */
  messageKey: OnboardingMessageKey;
  highlight: string | null;
  /** 자동 진행 트리거 타입 */
  triggerType: "manual" | "keypress" | "chat" | "click" | "modal-click";
  /** 트리거 대상 (keypress의 경우 키 목록, click의 경우 셀렉터) */
  triggerTarget?: string[] | string;
  /** 모달 열린 후 다음 하이라이트 대상 */
  afterModalHighlight?: string;
  /** 모달 열린 후 표시할 메시지 (i18n 키) */
  afterModalMessageKey?: OnboardingMessageKey;
  /** 추가 하이라이트 단계들 (모달 내 여러 단계 진행용) */
  modalSubSteps?: {
    highlight: string;
    /** i18n 키 (onboarding 네임스페이스 기준) */
    messageKey: OnboardingMessageKey;
    triggerType: "manual" | "click";
    triggerTarget?: string;
    /** 클릭 후 대기 시간 (ms) */
    delayAfterClick?: number;
    /** 스크롤하여 요소 보이게 할지 */
    scrollIntoView?: boolean;
  }[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "info",
    messageKey: "steps.info.message",
    highlight: null,
    triggerType: "manual",
  },
  {
    id: "move",
    messageKey: "steps.move.message",
    highlight: null,
    triggerType: "keypress",
    triggerTarget: [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ],
  },
  {
    id: "chat",
    messageKey: "steps.chat.message",
    highlight: null,
    triggerType: "chat",
  },
  {
    id: "progress",
    messageKey: "steps.progress.message",
    highlight: "#progress-bar-container",
    triggerType: "manual",
  },
  {
    id: "channel",
    messageKey: "steps.channel.message",
    highlight: "#channel-select-button",
    triggerType: "click",
    triggerTarget: "#channel-select-button",
  },
  {
    id: "leaderboard",
    messageKey: "steps.leaderboard.message",
    highlight: "#leaderboard-button",
    triggerType: "click",
    triggerTarget: "#leaderboard-button",
  },
  {
    id: "character",
    messageKey: "steps.character.message",
    highlight: "#user-info-button",
    triggerType: "modal-click",
    triggerTarget: "#user-info-button",
    afterModalHighlight: "#heatmap-info-link",
    afterModalMessageKey: "steps.character.afterModalMessage",
    modalSubSteps: [
      {
        highlight: "#pet-tab-button",
        messageKey: "steps.character.subSteps.petTab",
        triggerType: "click",
        triggerTarget: "#pet-tab-button",
        delayAfterClick: 2000,
      },
      {
        highlight: "#pet-gacha-button",
        messageKey: "steps.character.subSteps.petGacha",
        triggerType: "click",
        triggerTarget: "#pet-gacha-button",
        delayAfterClick: 6000,
        scrollIntoView: true,
      },
    ],
  },
  {
    id: "pet",
    messageKey: "steps.pet.message",
    highlight: null,
    triggerType: "manual",
  },
  {
    id: "task",
    messageKey: "steps.task.message",
    highlight: "#focus-panel",
    triggerType: "manual",
  },
];
