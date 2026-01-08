import * as Phaser from "phaser";

export interface ContributionController {
  /**
   * 특정 사용자의 기여도를 추가합니다.
   * @param username - GitHub 사용자 이름
   * @param count - 추가할 기여 수 (커밋 + PR)
   */
  addContribution: (username: string, count: number) => void;
  /**
   * 기여도를 일괄 설정합니다. (초기화용)
   * @param data - { username: count } 형태의 객체
   */
  setContributions: (data: Record<string, number>) => void;
  /**
   * 모든 기여도를 초기화합니다.
   */
  reset: () => void;
  /**
   * 기여도 리스트의 모든 요소를 제거합니다.
   */
  destroy: () => void;
}

const MAX_DISPLAY_COUNT = 5; // 상위 5명만 표시

/**
 * 프로그레스바 아래에 기여도 리스트를 생성합니다.
 *
 * @param scene - Phaser Scene 인스턴스
 * @param mapWidth - 맵의 너비 (중앙 정렬에 사용)
 * @param progressBarY - 프로그레스바의 Y 좌표
 * @returns 기여도를 제어할 수 있는 컨트롤러
 */
export function createContributionList(
  scene: Phaser.Scene,
  mapWidth: number,
  progressBarY: number,
): ContributionController {
  // 기여도 데이터 (username -> count)
  const contributions = new Map<string, number>();

  // 텍스트 객체
  const contributionText = scene.add.text(
    mapWidth / 2,
    progressBarY + 35, // 프로그레스바 아래
    "",
    {
      fontSize: "14px",
      color: "#374151",
      fontFamily: "monospace",
    },
  );
  contributionText.setOrigin(0.5, 0); // 중앙 정렬
  contributionText.setDepth(1000); // UI는 항상 최상위

  /**
   * 기여도 텍스트 업데이트
   */
  const updateDisplay = () => {
    // 기여도 순으로 정렬하여 상위 N명만 추출
    const sorted = Array.from(contributions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_DISPLAY_COUNT);

    if (sorted.length === 0) {
      contributionText.setText("");
      return;
    }

    // "username:count" 형식으로 표시
    const text = sorted.map(([name, count]) => `${name}:${count}`).join("  ");
    contributionText.setText(text);
  };

  /**
   * 기여도 추가
   */
  const addContribution = (username: string, count: number) => {
    const current = contributions.get(username) || 0;
    contributions.set(username, current + count);
    updateDisplay();
  };

  /**
   * 기여도 일괄 설정 (초기화용)
   */
  const setContributions = (data: Record<string, number>) => {
    contributions.clear();
    for (const [username, count] of Object.entries(data)) {
      contributions.set(username, count);
    }
    updateDisplay();
  };

  /**
   * 기여도 초기화
   */
  const reset = () => {
    contributions.clear();
    updateDisplay();
  };

  /**
   * 기여도 리스트의 모든 요소를 제거합니다.
   */
  const destroy = () => {
    contributionText.destroy();
  };

  return {
    addContribution,
    setContributions,
    reset,
    destroy,
  };
}
