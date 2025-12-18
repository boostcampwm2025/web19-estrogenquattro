import * as Phaser from "phaser";

/**
 * 맵 상단 중앙에 프로그레스바를 생성합니다.
 *
 * @param scene - Phaser Scene 인스턴스
 * @param mapWidth - 맵의 너비 (프로그레스바 중앙 정렬에 사용)
 *
 * @remarks
 * - 현재는 2초마다 10%씩 자동 증가하는 임시 로직이 포함되어 있습니다.
 * - 추후 API 연동 시 자동 증가 로직을 제거하고 외부에서 progress를 제어해야 합니다.
 */
export function createProgressBar(scene: Phaser.Scene, mapWidth: number) {
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
   * progrss bar 갱신 함수
   *  */
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

  // 추후 API 동작과 연계할 부분
  // 현재는 임시로 2초마다 progress 증가
  scene.time.addEvent({
    delay: 2000,
    loop: true,
    callback: () => {
      scene.tweens.add({
        targets: { value: progress },
        value: Math.min(progress + 10, 100),
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
          if (progress >= 100) {
            scene.time.delayedCall(100, () => {
              scene.tweens.add({
                targets: { value: progress },
                value: 0,
                duration: 200,
                ease: "Linear",
                onUpdate: (tween) => {
                  const value = tween.getValue();

                  if (typeof value === "number") {
                    progress = value;
                    updateBar();
                  }
                },
              });
            });
          }
        },
      });
    },
  });
}
