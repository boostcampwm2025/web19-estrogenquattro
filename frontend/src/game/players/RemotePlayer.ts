import * as Phaser from "phaser";
import BasePlayer from "./BasePlayer";
import type { Direction } from "../types/direction";
import { devLogger } from "@/lib/devLogger";

interface FocusTimeOptions {
  taskName?: string;
  lastFocusStartTime?: string | null;
  totalFocusMinutes?: number;
}

export default class RemotePlayer extends BasePlayer {
  private isFocusing: boolean = false;
  private focusTimeTimer: Phaser.Time.TimerEvent | null = null;
  private totalFocusMinutes: number = 0;
  private lastFocusStartTime: Date | null = null;

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
  setFocusState(isFocusing: boolean, options?: FocusTimeOptions) {
    this.isFocusing = isFocusing;
    this.totalFocusMinutes = options?.totalFocusMinutes ?? 0;

    // 기존 타이머 정리 (상태 변경 시 중복 방지)
    if (this.focusTimeTimer) {
      this.focusTimeTimer.destroy();
      this.focusTimeTimer = null;
    }

    if (isFocusing) {
      // 집중 시작: lastFocusStartTime 저장 및 타이머 시작
      this.lastFocusStartTime = options?.lastFocusStartTime
        ? new Date(options.lastFocusStartTime)
        : new Date();

      // 현재 집중 시간 표시
      this.updateFocusTimeDisplay();

      // 1초마다 집중 시간 UI 업데이트 (로컬 계산)
      this.focusTimeTimer = this.scene.time.addEvent({
        delay: 1000,
        callback: () => this.updateFocusTimeDisplay(),
        loop: true,
      });
    } else {
      // 휴식 시작: 누적 시간만 표시
      this.lastFocusStartTime = null;
      this.updateFocusTime(this.totalFocusMinutes * 60);
    }

    this.updateTaskBubble({ isFocusing, taskName: options?.taskName });
  }

  private updateFocusTimeDisplay() {
    if (!this.isFocusing || !this.lastFocusStartTime) {
      this.updateFocusTime(this.totalFocusMinutes * 60);
      return;
    }

    // 현재 세션 집중 시간(초) = (현재 시간 - 시작 시간) / 1000
    const currentSessionSeconds = Math.floor(
      (Date.now() - this.lastFocusStartTime.getTime()) / 1000,
    );
    // 총 집중 시간(초) = 누적(분) * 60 + 현재 세션(초)
    const totalSeconds = this.totalFocusMinutes * 60 + currentSessionSeconds;
    this.updateFocusTime(totalSeconds);
  }

  getFocusState(): boolean {
    return this.isFocusing;
  }

  // 자원 해제 오버라이드
  destroy() {
    if (this.focusTimeTimer) {
      this.focusTimeTimer.destroy();
      this.focusTimeTimer = null;
    }
    super.destroy();
  }

  // 서버에서 받은 상태로 업데이트
  updateState(state: {
    x: number;
    y: number;
    isMoving: boolean;
    direction: Direction;
  }) {
    if (!this.body) {
      devLogger.error("RemotePlayer body not found");
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
