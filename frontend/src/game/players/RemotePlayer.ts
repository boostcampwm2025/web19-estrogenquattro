import * as Phaser from "phaser";
import BasePlayer from "./BasePlayer";
import type { Direction } from "../types/direction";

export default class RemotePlayer extends BasePlayer {
  private isFocusing: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    texture: string, // 유저네임(텍스처 키) 받기
  ) {
    super(scene, x, y, username, id, texture);
  }

  // 집중 상태 설정 (SocketManager에서 focused/rested 이벤트 수신 시 호출)
  setFocusState(isFocusing: boolean, taskName?: string) {
    this.isFocusing = isFocusing;
    this.updateTaskBubble({ isFocusing, taskName });
  }

  getFocusState(): boolean {
    return this.isFocusing;
  }

  // 서버에서 받은 상태로 업데이트
  updateState(state: {
    x: number;
    y: number;
    isMoving: boolean;
    direction: Direction;
  }) {
    if (!this.body) {
      console.error("RemotePlayer body not found");
      return;
    }

    // 공통 update 호출 (마스크 동기화)
    super.update();

    // 1. 위치 보정 (너무 멀어지면 강제 동기화)
    const dist = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      state.x,
      state.y,
    );
    if (dist > 50) {
      this.container.setPosition(state.x, state.y);
    }

    // 부드러운 위치 보정을 위해 lerp 사용
    this.container.x = Phaser.Math.Linear(this.container.x, state.x, 0.1);
    this.container.y = Phaser.Math.Linear(this.container.y, state.y, 0.1);

    // 2. 속도 동기화 (움직임 반영)
    this.body.setVelocity(0); // 일단 정지

    if (state.isMoving) {
      // 방향 문자열 파싱해서 속도 적용
      if (state.direction.includes("left")) {
        this.body.setVelocityX(-this.speed);
        this.playAnimation("walk-left");
      }
      if (state.direction.includes("right")) {
        this.body.setVelocityX(this.speed);
        this.playAnimation("walk-right");
      }
      if (state.direction.includes("up")) {
        this.body.setVelocityY(-this.speed);
        this.playAnimation("walk-up");
      }
      if (state.direction.includes("down")) {
        this.body.setVelocityY(this.speed);
        this.playAnimation("walk-down");
      }
    } else {
      // 멈췄을 때
      this.stopAnimation();
      // 멈췄을 때는 좌표 강제 동기화 (정확한 위치 안착)
      this.container.setPosition(state.x, state.y);
    }

    // 펫 위치 업데이트
    this.updatePetPosition(state.direction);
  }
}
