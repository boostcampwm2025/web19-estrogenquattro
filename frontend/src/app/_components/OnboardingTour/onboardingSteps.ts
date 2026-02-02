export interface OnboardingStep {
  id: string;
  message: string;
  highlight: string | null;
  /** 자동 진행 트리거 타입 */
  triggerType: "manual" | "keypress" | "chat" | "click" | "modal-click";
  /** 트리거 대상 (keypress의 경우 키 목록, click의 경우 셀렉터) */
  triggerTarget?: string[] | string;
  /** 모달 열린 후 다음 하이라이트 대상 */
  afterModalHighlight?: string;
  /** 모달 열린 후 표시할 메시지 */
  afterModalMessage?: string;
  /** 추가 하이라이트 단계들 (모달 내 여러 단계 진행용) */
  modalSubSteps?: {
    highlight: string;
    message: string;
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
    message:
      "안녕하세요. ' 잔디 심고 갈래? ' 에 오신 것을 환영합니다!<br>저는 간단한 서비스 사용 방법을 안내해 드릴 젠킨수예요. 함께 둘러볼까요?",
    highlight: null,
    triggerType: "manual",
  },
  {
    id: "move",
    message:
      "이곳은 여러분만의 공간이에요!<br>방향키(↑,↓,←,→) 또는 WASD 키로 캐릭터를 자유롭게 움직여 보세요!",
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
    message:
      "다른 동료들과 소통하고 싶으신가요?<br>엔터를 눌러 채팅창을 열고, 메시지를 입력한 뒤 다시 엔터를 눌러 보세요!",
    highlight: null,
    triggerType: "chat",
  },
  {
    id: "progress",
    message:
      "이 게이지는 우리 모두의 '열정'이에요! 여러분이 코딩에 집중하고 깃허브 활동을 할 때마다 게이지가 차오릅니다.<br>함께 힘을 모아 게이지를 채우면 무슨 일이 벌어질까요?!",
    highlight: "#progress-bar-container",
    triggerType: "manual",
  },
  {
    id: "leaderboard",
    message:
      "당신의 기여도는 몇 위인가요? 누가 가장 몰입했는지 확인해 보세요!<br>매주 새로운 시즌이 시작되니, 이번 주 '기여왕' 에 도전해 보는 건 어떨까요?",
    highlight: "#leaderboard-button",
    triggerType: "click",
    triggerTarget: "#leaderboard-button",
  },
  {
    id: "character",
    message:
      "나만의 프로필이 궁금하다면?<br>유저 정보 버튼이나 게임 속 캐릭터를 클릭해서 모달창을 열어 보세요!",
    highlight: "#user-info-button",
    triggerType: "modal-click",
    triggerTarget: "#user-info-button",
    afterModalHighlight: "#heatmap-info-link",
    afterModalMessage:
      "프로필 탭에서는 집중 이력을 확인할 수 있어요!<br>여기서 포인트 획득 정책도 확인할 수 있어요.",
    modalSubSteps: [
      {
        highlight: "#pet-tab-button",
        message: "이제 펫 탭을 클릭해서 귀여운 펫 친구들을 만나 보세요!",
        triggerType: "click",
        triggerTarget: "#pet-tab-button",
        delayAfterClick: 2000,
      },
      {
        highlight: "#pet-gacha-button",
        message:
          "처음 오셨군요! 펫 뽑기 버튼을 눌러 첫 번째 펫 친구를 만나 보세요!",
        triggerType: "click",
        triggerTarget: "#pet-gacha-button",
        delayAfterClick: 6000,
        scrollIntoView: true,
      },
    ],
  },
  {
    id: "pet",
    message:
      "축하해요! 첫 펫을 만났네요!<br>펫에게 먹이를 주며 성장시키고, 진화시킬 수 있어요. 도감에서 대표 펫도 변경할 수 있어요!",
    highlight: null,
    triggerType: "manual",
  },
  {
    id: "task",
    message:
      "마지막으로, 우측 상단의 작업 패널에서 타이머와 음악을 켤 수 있어요!<br>자, 이제 집중 모드를 시작해 볼까요? 화이팅!",
    highlight: "#focus-panel",
    triggerType: "manual",
  },
];
