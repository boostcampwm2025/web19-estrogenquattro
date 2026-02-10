export interface OnboardingStep {
  id: string;
  /** i18n 키 (onboarding 네임스페이스 기준) */
  messageKey: string;
  highlight: string | null;
  /** 자동 진행 트리거 타입 */
  triggerType: "manual" | "keypress" | "chat" | "click" | "modal-click";
  /** 트리거 대상 (keypress의 경우 키 목록, click의 경우 셀렉터) */
  triggerTarget?: string[] | string;
  /** 모달 열린 후 다음 하이라이트 대상 */
  afterModalHighlight?: string;
  /** 모달 열린 후 표시할 메시지 (i18n 키) */
  afterModalMessageKey?: string;
  /** 추가 하이라이트 단계들 (모달 내 여러 단계 진행용) */
  modalSubSteps?: {
    highlight: string;
    /** i18n 키 (onboarding 네임스페이스 기준) */
    messageKey: string;
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
    message:
      "현재 채널을 확인하고 변경하고 싶으신가요?<br>채널 버튼을 눌러 다른 채널로 이동하여 새로운 친구들을 만나보세요!",
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
