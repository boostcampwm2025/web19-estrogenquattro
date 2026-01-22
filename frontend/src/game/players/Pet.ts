import * as Phaser from "phaser";
import { DIRECTION } from "../constants/direction";
import type { Direction } from "../types/direction";

export default class Pet {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Image | null = null;
  private currentDirection: Direction = DIRECTION.STOP;
  private offset = { x: 35, y: 0 }; // 기본: 오른쪽

  // 거리 및 크기 설정
  private readonly PET_SIZE = 50; // 펫 크기 (너비/높이)
  private readonly DISTANCE_X = 40; // 좌우 거리
  private readonly DISTANCE_Y = 50; // 위아래 거리
  private readonly BODY_CENTER_Y = 5;

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.container = container;
  }

  setTexture(key: string): void {
    if (!this.scene.textures.exists(key)) return;

    if (!this.sprite) {
      this.sprite = this.scene.add.image(this.offset.x, this.offset.y, key);
      this.setSpriteScale();
      this.sprite.setOrigin(0.5, 0.5);
      // 컨테이너에 추가하고 맨 뒤로 보냄
      this.container.add(this.sprite);
      this.container.sendToBack(this.sprite);
    } else {
      this.sprite.setTexture(key);
      this.setSpriteScale(); // 텍스처 변경 후 사이즈 재설정
    }
  }

  // 비율 유지하며 크기 조절 (Fit)
  private setSpriteScale(): void {
    if (!this.sprite) return;

    // 원본 크기
    const width = this.sprite.width;
    const height = this.sprite.height;

    // 더 긴 쪽을 기준으로 스케일 계산
    const scale = this.PET_SIZE / Math.max(width, height);

    this.sprite.setScale(scale);
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
