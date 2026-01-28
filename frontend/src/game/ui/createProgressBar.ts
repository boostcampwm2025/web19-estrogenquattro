import * as Phaser from "phaser";

export interface ProgressBarController {
  /**
   * 프로그레스를 특정 값으로 설정합니다. (절대값 동기화)
   * @param value - 설정할 값 (0-100)
   */
  setProgress: (value: number) => void;
  /**
   * 프로그레스를 0으로 리셋합니다.
   */
  reset: () => void;
  /**
   * 현재 프로그레스 값을 반환합니다.
   */
  getProgress: () => number;
  /**
   * 프로그레스바의 모든 그래픽 요소를 제거합니다.
   */
  destroy: () => void;
}

/**
 * 맵 상단 중앙에 프로그레스바를 생성합니다.
 *
 * @param scene - Phaser Scene 인스턴스
 * @param mapWidth - 맵의 너비 (프로그레스바 중앙 정렬에 사용)
 * @returns 프로그레스바를 제어할 수 있는 컨트롤러
 *
 * @remarks
 * - 절대값 동기화: 서버에서 받은 값을 그대로 표시
 * - 맵 전환은 서버의 map_switch 이벤트로 처리
 */
export function createProgressBar(
  scene: Phaser.Scene,
  mapWidth: number,
): ProgressBarController {
  const config = {
    width: 384,
    height: 24,
    x: mapWidth / 2 - 192,
    y: 50,
    radius: 12,
    border: 1,
  };

  let progress = 0;

  // 배경
  const progressBarBg = scene.add.graphics();
  progressBarBg.fillStyle(0xe5e7eb, 1);
  progressBarBg.fillRoundedRect(
    config.x,
    config.y,
    config.width,
    config.height,
    config.radius,
  );
  progressBarBg.lineStyle(config.border, 0x1f2937, 1);
  progressBarBg.strokeRoundedRect(
    config.x,
    config.y,
    config.width,
    config.height,
    config.radius,
  );
  progressBarBg.setDepth(1000); // UI는 항상 최상위

  const progressBar = scene.add.graphics();
  progressBar.setDepth(1001); // 프로그레스바는 배경보다 위

  /**
   * 프로그레스 바 갱신 함수
   */
  const updateBar = () => {
    progressBar.clear();

    const padding = config.border + 2;
    const fillWidth = ((config.width - padding * 2) * progress) / 100;
    const innerRadius = config.radius - padding;
    const innerHeight = config.height - padding * 2;

    if (fillWidth > 0) {
      progressBar.fillStyle(0x4ade80, 1);

      // 너비가 충분하면 양쪽 둥글게, 아니면 왼쪽만 둥글게
      if (fillWidth >= innerRadius * 2) {
        progressBar.fillRoundedRect(
          config.x + padding,
          config.y + padding,
          fillWidth,
          innerHeight,
          innerRadius,
        );
      } else {
        // 작은 값일 때: 왼쪽만 둥글게 (tl, bl만 radius 적용)
        const actualWidth = Math.max(fillWidth, innerRadius);
        progressBar.fillRoundedRect(
          config.x + padding,
          config.y + padding,
          actualWidth,
          innerHeight,
          { tl: innerRadius, tr: 0, bl: innerRadius, br: 0 },
        );
      }
    }
  };

  updateBar();

  /**
   * 애니메이션과 함께 프로그레스 값 설정
   */
  const animateToProgress = (
    targetProgress: number,
    onComplete?: () => void,
  ) => {
    scene.tweens.add({
      targets: { value: progress },
      value: targetProgress,
      duration: 300,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        if (typeof value === "number") {
          progress = value;
          updateBar();
        }
      },
      onComplete: () => {
        onComplete?.();
      },
    });
  };

  /**
   * 프로그레스를 특정 값으로 설정합니다. (절대값 동기화)
   */
  const setProgress = (value: number) => {
    const targetProgress = Math.max(0, Math.min(100, value));
    animateToProgress(targetProgress);
  };

  /**
   * 프로그레스를 0으로 리셋합니다.
   */
  const reset = () => {
    animateToProgress(0);
  };

  /**
   * 현재 프로그레스 값을 반환합니다.
   */
  const getProgress = () => progress;

  /**
   * 프로그레스바의 모든 그래픽 요소를 제거합니다.
   */
  const destroy = () => {
    progressBarBg.destroy();
    progressBar.destroy();
  };

  const controller: ProgressBarController = {
    setProgress,
    reset,
    getProgress,
    destroy,
  };

  return controller;
}
