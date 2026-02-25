import * as Phaser from "phaser";
import BasePlayer from "./BasePlayer";
import type { Direction } from "../types/direction";
import { devLogger } from "@/lib/devLogger";

interface FocusTimeOptions {
  taskName?: string;
  totalFocusSeconds?: number;
  currentSessionSeconds?: number;
}

export default class RemotePlayer extends BasePlayer {
  private isFocusing: boolean = false;
  private baseFocusSeconds: number = 0; // 이전 세션까지의 누적 시간
  private serverCurrentSessionSeconds: number = 0; // 서버가 계산한 현재 세션 경과 시간
  private serverReceivedAt: number = 0; // 서버 응답 수신 시점

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    texture: string, // 유저네임(텍스처 키) 받기
    playerId: number = 0,
  ) {
    super(scene, x, y, username, id, texture, playerId);
  }

  // 집중 상태 설정 (SocketManager에서 focused/rested 이벤트 수신 시 호출)
  setFocusState(isFocusing: boolean, options?: FocusTimeOptions) {
    this.isFocusing = isFocusing;
    this.baseFocusSeconds = options?.totalFocusSeconds ?? 0;

    if (isFocusing) {
      this.serverCurrentSessionSeconds = options?.currentSessionSeconds ?? 0;
      this.serverReceivedAt = Date.now();
    } else {
      this.serverCurrentSessionSeconds = 0;
      this.serverReceivedAt = 0;
    }

    // 초기 표시
    this.updateFocusDisplay();
    this.updateTaskBubble({ isFocusing, taskName: options?.taskName });
  }

  // 타임스탬프 기반 표시 시간 계산 (브라우저 쓰로틀링 무관)
  getDisplayTime(): number {
    if (this.isFocusing && this.serverReceivedAt > 0) {
      const clientElapsed = Math.floor(
        (Date.now() - this.serverReceivedAt) / 1000,
      );
      return (
        this.baseFocusSeconds + this.serverCurrentSessionSeconds + clientElapsed
      );
    }
    return this.baseFocusSeconds;
  }

  // UI 업데이트 (getDisplayTime 결과를 화면에 반영)
  updateFocusDisplay() {
    this.updateFocusTime(this.getDisplayTime());
  }

  getFocusState(): boolean {
    return this.isFocusing;
  }

  private prevPos = { x: 0, y: 0 };
  private targetPos = { x: 0, y: 0 };
  private lastReceivedAt = 0;
  private readonly TICK_INTERVAL = 100;

  // 서버에서 받은 상태로 업데이트 (10Hz 수신)
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

    // 새 위치 수신 시 보간 시작점 업데이트
    this.prevPos = { x: this.container.x, y: this.container.y };
    this.targetPos = { x: state.x, y: state.y };
    this.lastReceivedAt = Date.now();

    // 위치 보정 (너무 멀어지면 강제 동기화)
    const dist = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      state.x,
      state.y,
    );
    if (dist > 50) {
      this.container.setPosition(state.x, state.y);
      this.prevPos = { x: state.x, y: state.y };
    }

    // 애니메이션 업데이트
    if (state.isMoving) {
      if (state.direction.includes("left")) this.playAnimation("walk-left");
      else if (state.direction.includes("right"))
        this.playAnimation("walk-right");
      else if (state.direction.includes("up")) this.playAnimation("walk-up");
      else if (state.direction.includes("down"))
        this.playAnimation("walk-down");
    } else {
      this.stopAnimation();
    }

    // 펫 위치 업데이트
    this.updatePetPosition(state.direction);
  }

  update() {
    // 공통 update 호출 (마스크 동기화)
    super.update();

    if (!this.body) return;
    this.body.setVelocity(0); // 물리 속도 비활성화

    // 수신된 위치로 시간 기반 보간 (Time-Based Interpolation)
    if (this.lastReceivedAt > 0) {
      const now = Date.now();
      // TICK_INTERVAL 동안 prevPos에서 targetPos로 선형 보간
      const elapsed = now - this.lastReceivedAt;
      const t = Math.min(elapsed / this.TICK_INTERVAL, 1.0);

      this.container.x = Phaser.Math.Linear(
        this.prevPos.x,
        this.targetPos.x,
        t,
      );
      this.container.y = Phaser.Math.Linear(
        this.prevPos.y,
        this.targetPos.y,
        t,
      );
    }
  }
}
