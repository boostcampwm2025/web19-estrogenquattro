import * as Phaser from "phaser";

export default class IrisTransition {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private mask: Phaser.Display.Masks.GeometryMask;
  private isTransitioning: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // 마스크로 사용할 그래픽 객체 생성 (화면에 직접 보이지 않음)
    this.graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    // 지오메트리 마스크 생성
    this.mask = new Phaser.Display.Masks.GeometryMask(
      this.scene,
      this.graphics,
    );
    // 마스크 반전 아님 (우리는 원 안을 보여주고 밖을 가릴 것임)
    this.mask.setInvertAlpha(false);
  }

  /**
   * 아이리스 닫기 효과 (화면이 플레이어 중심으로 줄어들며 검어짐)
   * @param x 중심 x 좌표
   * @param y 중심 y 좌표
   * @param duration 지속 시간 (ms)
   * @param onComplete 완료 콜백
   */
  close(
    x: number,
    y: number,
    duration: number = 1000,
    onComplete?: () => void,
  ) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // 카메라에 마스크 적용
    this.scene.cameras.main.setMask(this.mask);

    // 화면 대각선 길이 계산 (충분히 큰 반지름)
    const { width, height } = this.scene.cameras.main;
    const maxRadius = Math.sqrt(width * width + height * height);

    // 트윈 애니메이션
    const tweenObj = { radius: maxRadius };

    this.scene.tweens.add({
      targets: tweenObj,
      radius: 0,
      duration: duration,
      ease: "Power2",
      onUpdate: () => {
        this.graphics.clear();
        this.graphics.fillCircle(x, y, tweenObj.radius);
      },
      onComplete: () => {
        // 애니메이션 끝나면 화면이 완전히 검은 상태 (반지름 0)
        onComplete?.();
        // 마스크는 유지 (소켓 연결되는 동안 검은 화면 유지)
      },
    });
  }

  /**
   * 아이리스 열기 효과 (화면이 플레이어 중심으로 늘어나며 밝아짐)
   * @param x 중심 x 좌표
   * @param y 중심 y 좌표
   * @param duration 지속 시간 (ms)
   * @param onComplete 완료 콜백
   */
  open(x: number, y: number, duration: number = 1000, onComplete?: () => void) {
    // 닫힌 상태에서 시작한다고 가정

    // 카메라에 마스크 적용 확인
    this.scene.cameras.main.setMask(this.mask);

    const { width, height } = this.scene.cameras.main;
    const maxRadius = Math.sqrt(width * width + height * height);

    const tweenObj = { radius: 0 };

    this.scene.tweens.add({
      targets: tweenObj,
      radius: maxRadius,
      duration: duration,
      ease: "Power2",
      onUpdate: () => {
        this.graphics.clear();
        this.graphics.fillCircle(x, y, tweenObj.radius);
      },
      onComplete: () => {
        this.isTransitioning = false;
        // 애니메이션 끝나면 마스크 제거 (성능 및 일반 렌더링 복귀)
        this.scene.cameras.main.clearMask();
        this.graphics.clear();
        onComplete?.();
      },
    });
  }

  /**
   * 단순히 화면을 원형으로 가림 (애니메이션 없음)
   */
  setMask(x: number, y: number, radius: number) {
    this.scene.cameras.main.setMask(this.mask);
    this.graphics.clear();
    this.graphics.fillCircle(x, y, radius);
  }

  destroy() {
    this.graphics.destroy();
    this.scene.cameras.main.clearMask();
  }
}
