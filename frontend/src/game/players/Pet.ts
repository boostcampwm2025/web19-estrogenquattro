import * as Phaser from "phaser";

export default class Pet {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Image | null = null;
  private currentDirection: string = "stop";
  private offset = { x: 0, y: 55 }; // 기본: 아래쪽 (몸통 중심 y:5 기준)

  // 거리 설정
  private readonly DISTANCE_X = 35; // 좌우 거리
  private readonly DISTANCE_Y = 50; // 위아래 거리
  private readonly BODY_CENTER_Y = 5;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    if (scene.textures.exists("pet")) {
      this.sprite = scene.add.image(this.offset.x, this.offset.y, "pet");
      this.sprite.setDisplaySize(64, 64);
      this.sprite.setOrigin(0.5, 0.5);
      this.sprite.setDepth(-1);
    }
  }

  getSprite(): Phaser.GameObjects.Image | null {
    return this.sprite;
  }

  updatePosition(direction: string): void {
    if (!this.sprite || direction === this.currentDirection) return;

    this.currentDirection = direction;

    let targetX = 0;
    let targetY = this.BODY_CENTER_Y + this.DISTANCE_Y; // 기본값 (stop일 때 아래쪽)

    switch (direction) {
      case "left":
        targetX = this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y;
        break;
      case "right":
        targetX = -this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y;
        break;
      case "up":
        targetX = 0;
        targetY = this.BODY_CENTER_Y + this.DISTANCE_Y;
        break;
      case "down":
        targetX = 0;
        targetY = this.BODY_CENTER_Y - this.DISTANCE_Y;
        break;
      case "left-up":
        targetX = this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y + this.DISTANCE_X;
        break;
      case "left-down":
        targetX = this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y - this.DISTANCE_X;
        break;
      case "right-up":
        targetX = -this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y + this.DISTANCE_X;
        break;
      case "right-down":
        targetX = -this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y - this.DISTANCE_X;
        break;
      case "stop":
      default:
        // 마지막 위치 유지
        return;
    }

    // 부드러운 이동 (Tween)
    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      duration: 150,
      ease: "Power2",
    });

    this.offset = { x: targetX, y: targetY };
  }

  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
