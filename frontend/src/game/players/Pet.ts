import * as Phaser from "phaser";
import { DIRECTION } from "../constants/direction";
import type { Direction } from "../types/direction";

export default class Pet {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Image | null = null;
  private currentDirection: Direction = DIRECTION.STOP;
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

  updatePosition(direction: Direction): void {
    if (!this.sprite || direction === this.currentDirection) return;

    this.currentDirection = direction;

    let targetX = 0;
    let targetY = this.BODY_CENTER_Y + this.DISTANCE_Y; // 기본값 (stop일 때 아래쪽)

    switch (direction) {
      case DIRECTION.LEFT:
        targetX = this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y;
        break;
      case DIRECTION.RIGHT:
        targetX = -this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y;
        break;
      case DIRECTION.UP:
        targetX = 0;
        targetY = this.BODY_CENTER_Y + this.DISTANCE_Y;
        break;
      case DIRECTION.DOWN:
        targetX = 0;
        targetY = this.BODY_CENTER_Y - this.DISTANCE_Y;
        break;
      case DIRECTION.LEFT_UP:
        targetX = this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y + this.DISTANCE_X;
        break;
      case DIRECTION.LEFT_DOWN:
        targetX = this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y - this.DISTANCE_X;
        break;
      case DIRECTION.RIGHT_UP:
        targetX = -this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y + this.DISTANCE_X;
        break;
      case DIRECTION.RIGHT_DOWN:
        targetX = -this.DISTANCE_X;
        targetY = this.BODY_CENTER_Y - this.DISTANCE_X;
        break;
      case DIRECTION.STOP:
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
