import * as Phaser from "phaser";

export interface ProgressBarController {
  /**
   * 프로그레스를 특정 양만큼 증가시킵니다.
   * @param amount - 증가시킬 양 (%)
   */
  addProgress: (amount: number) => void;
  /**
   * 프로그레스를 특정 값으로 설정합니다.
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
}

/**
 * 맵 상단 중앙에 프로그레스바를 생성합니다.
 *
 * @param scene - Phaser Scene 인스턴스
 * @param mapWidth - 맵의 너비 (프로그레스바 중앙 정렬에 사용)
 * @returns 프로그레스바를 제어할 수 있는 컨트롤러
 *
 * @remarks
 * - 프로그레스바 규칙:
 *   - 커밋당 증가량: 5%
 *   - 100% 도달 시: 리셋 (0%로 초기화)
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

  const progressBar = scene.add.graphics();

  /**
   * 프로그레스 바 갱신 함수
   */
  const updateBar = () => {
    progressBar.clear();

    const padding = config.border + 2;
    const fillWidth = ((config.width - padding * 2) * progress) / 100;

    if (fillWidth > 0) {
      progressBar.fillStyle(0x4ade80, 1);
      progressBar.fillRoundedRect(
        config.x + padding,
        config.y + padding,
        fillWidth,
        config.height - padding * 2,
        config.radius - padding,
      );
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
   * 프로그레스를 특정 양만큼 증가시킵니다.
   * 100%에 도달하면 자동으로 리셋됩니다.
   */
  const addProgress = (amount: number) => {
    const newProgress = Math.min(progress + amount, 100);

    animateToProgress(newProgress, () => {
      if (progress >= 100) {
        // 100% 도달 시 잠시 후 리셋
        scene.time.delayedCall(100, () => {
          animateToProgress(0);
        });
      }
    });
  };

  /**
   * 프로그레스를 특정 값으로 설정합니다. (초기화용)
   */
  const setProgress = (value: number) => {
    progress = Math.max(0, Math.min(100, value));
    updateBar();
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

  return {
    addProgress,
    setProgress,
    reset,
    getProgress,
  };
}
