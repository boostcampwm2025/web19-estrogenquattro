import { emitEvent } from "../../lib/socket";
import BasePlayer from "./BasePlayer";
import { DIRECTION } from "../constants/direction";
import type { Direction } from "../types/direction";
import { encodeMoveData } from "../utils/moveProtocol";
import { useModalStore } from "../../stores/useModalStore";

export default class Player extends BasePlayer {
  private roomId: string;
  private prevMoving: boolean = false;
  private tickTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    roomId: string,
    playerId: number = 0,
  ) {
    // 부모 생성자 호출 (공통 렌더링 & 물리 설정 처리)
    // Local player는 자신의 GitHub ID를 texture key로 사용
    const texture = username;
    super(scene, x, y, username, id, texture, playerId);
    this.roomId = roomId;
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  update(
    cursors?: Phaser.Types.Input.Keyboard.CursorKeys,
    wasdKeys?: {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    },
  ) {
    // 부모 update 호출 (마스크 동기화)
    super.update();

    if (!this.body || !cursors) return;

    // 모달이 열려있으면 이동 차단 (멈춘 상태로 원격 동기화 후 종료)
    if (useModalStore.getState().activeModal !== null) {
      this.body.setVelocity(0, 0);
      if (this.prevMoving) {
        const binaryPayload = encodeMoveData(
          this.container.x,
          this.container.y,
          DIRECTION.STOP,
          false,
        );
        emitEvent("moving", binaryPayload);
        this.prevMoving = false;
      }
      return;
    }

    // 1. 현재 프레임의 이동 의도 파악
    let velocityX = 0;
    let velocityY = 0;

    // 방향 문자열 조합 (예: "left", "right-up")
    let hDir = "";
    let vDir = "";

    // 방향키 또는 WASD 키 모두 지원
    if (cursors.left.isDown || wasdKeys?.A.isDown) {
      velocityX = -this.speed;
      hDir = "left";
    } else if (cursors.right.isDown || wasdKeys?.D.isDown) {
      velocityX = this.speed;
      hDir = "right";
    }

    if (cursors.up.isDown || wasdKeys?.W.isDown) {
      velocityY = -this.speed;
      vDir = "up";
    } else if (cursors.down.isDown || wasdKeys?.S.isDown) {
      velocityY = this.speed;
      vDir = "down";
    }

    // 실제 물리 적용
    this.body.setVelocity(velocityX, velocityY);

    // 2. 이동 상태 판단
    let isMoving = velocityX !== 0 || velocityY !== 0;

    // 이동 키를 눌렀어도 물리적으로 막혀있으면(blocked) 멈춘 것으로 처리
    if (isMoving) {
      const blocked = this.body.blocked;
      if (hDir === "left" && blocked.left) isMoving = false;
      if (hDir === "right" && blocked.right) isMoving = false;
      if (vDir === "up" && blocked.up) isMoving = false;
      if (vDir === "down" && blocked.down) isMoving = false;
    }

    // 방향 문자열 생성 (예: "left-up", "right", "stop")
    let currentDirection: Direction = DIRECTION.STOP;
    if (isMoving) {
      if (hDir && vDir) currentDirection = `${hDir}-${vDir}` as Direction;
      else if (hDir) currentDirection = hDir as Direction;
      else if (vDir) currentDirection = vDir as Direction;
    }

    // 애니메이션 업데이트
    if (isMoving) {
      // 대각선 이동 시 하나만 선택 (좌/우 우선)
      if (hDir === "left") this.playAnimation("walk-left");
      else if (hDir === "right") this.playAnimation("walk-right");
      else if (vDir === "up") this.playAnimation("walk-up");
      else if (vDir === "down") this.playAnimation("walk-down");
    } else {
      this.stopAnimation();
    }

    // Fixed 10Hz Tick Rate (ZEP 스타일, 100ms 간격 전송)
    // - 이동 중: 100ms마다 정확히 1번씩만 전송 (네트워크 대역폭 1/6로 감소)
    // - 정지 시: 이동→정지 전환 시 즉시 1회 전송 후 중단
    const now = Date.now();
    const TICK_INTERVAL = 100; // 10Hz (100ms)

    if (isMoving) {
      if (now - this.tickTimer >= TICK_INTERVAL) {
        const binaryPayload = encodeMoveData(
          this.container.x,
          this.container.y,
          currentDirection,
          isMoving,
        );
        emitEvent("moving", binaryPayload);
        this.tickTimer = now;
      }
    } else if (this.prevMoving) {
      // 멈춘 순간에는 즉시 전송하여 정확한 목적지 상태 동기화
      const binaryPayload = encodeMoveData(
        this.container.x,
        this.container.y,
        currentDirection,
        isMoving,
      );
      emitEvent("moving", binaryPayload);
    }

    this.prevMoving = isMoving;

    // 펫 위치 업데이트
    this.updatePetPosition(currentDirection);
  }
}
