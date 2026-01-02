import { emitEvent } from "../../lib/socket";
import { formatPlayTime } from "@/utils/timeFormat";

export default class Player {
  private scene: Phaser.Scene;
  private bodySprite: Phaser.GameObjects.Sprite; // 몸통 스프라이트 추가
  private container: Phaser.GameObjects.Container;
  private body: Phaser.Physics.Arcade.Body;
  private maskShape: Phaser.GameObjects.Graphics;
  private timerText: Phaser.GameObjects.Text;
  private speed: number = 300;
  public id: string;
  private roomId: string;

  // 이전 프레임의 상태 저장용
  private prevState = {
    isMoving: false,
    direction: "stop",
  };
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    roomId: string,
  ) {
    this.scene = scene;
    this.id = id;
    this.roomId = roomId;

    // 1. 컨테이너 생성
    this.container = scene.add.container(x, y);

    // 2. 몸통 스프라이트 생성
    this.bodySprite = scene.add.sprite(0, 5, "body");
    // 초기 애니메이션
    this.bodySprite.setFrame(0); // 0번 프레임(Down 정지)

    // 3. 얼굴 & 마스크
    const FACE_RADIUS = 17;
    const FACE_Y_OFFSET = 0; // 얼굴 위치

    this.maskShape = scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillCircle(0, 0, FACE_RADIUS);
    const mask = this.maskShape.createGeometryMask();

    const faceSprite = scene.add.image(0, FACE_Y_OFFSET, "face");
    faceSprite.setDisplaySize(FACE_RADIUS * 2, FACE_RADIUS * 2);
    faceSprite.setMask(mask);

    // 4. 테두리
    const borderGraphics = scene.add.graphics();
    borderGraphics.lineStyle(2, 0xffffff, 1);
    borderGraphics.strokeCircle(0, FACE_Y_OFFSET, FACE_RADIUS);

    const nameTag = scene.add
      .text(0, 50, username, {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    // 5. 접속 시간 표시
    this.timerText = scene.add
      .text(0, -35, formatPlayTime(0), {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.timerText.setStroke("#000000", 4);
    this.timerText.setShadow(1, 1, "#000000", 2, false, true);

    // 6. 컨테이너 추가 (순서 중요: 먼저 추가된 것이 뒤에 깔림)

    this.container.add([
      this.bodySprite,
      faceSprite,
      borderGraphics,
      this.timerText,
      nameTag,
    ]);
    this.container.setSize(FACE_RADIUS * 2, FACE_RADIUS * 3);

    // 6. 물리 엔진 적용
    scene.physics.world.enable(this.container);
    this.body = this.container.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);

    this.body.setSize(FACE_RADIUS * 2, FACE_RADIUS * 3);
    this.body.setOffset(0, 10);
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    if (!this.body) return;

    // 1. 현재 프레임의 이동 의도 파악
    let velocityX = 0;
    let velocityY = 0;

    // 방향 문자열 조합 (예: "left", "right-up")
    let hDir = "";
    let vDir = "";

    if (cursors.left.isDown) {
      velocityX = -this.speed;
      hDir = "left";
    } else if (cursors.right.isDown) {
      velocityX = this.speed;
      hDir = "right";
    }

    if (cursors.up.isDown) {
      velocityY = -this.speed;
      vDir = "up";
    } else if (cursors.down.isDown) {
      velocityY = this.speed;
      vDir = "down";
    }

    // 실제 물리 적용
    this.body.setVelocity(velocityX, velocityY);

    // 마스크 동기화
    if (this.maskShape) {
      this.maskShape.x = this.container.x;
      this.maskShape.y = this.container.y;
    }

    // 2. 상태 변화 감지 및 소켓 전송
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
    let currentDirection = "stop";
    if (isMoving) {
      if (hDir && vDir) currentDirection = `${hDir}-${vDir}`;
      else if (hDir) currentDirection = hDir;
      else if (vDir) currentDirection = vDir;
    }

    // 애니메이션 업데이트
    if (this.bodySprite) {
      if (isMoving) {
        // 대각선 이동 시 하나만 선택 (좌/우 우선)
        if (hDir === "left") this.bodySprite.play("walk-left", true);
        else if (hDir === "right") this.bodySprite.play("walk-right", true);
        else if (vDir === "up") this.bodySprite.play("walk-up", true);
        else if (vDir === "down") this.bodySprite.play("walk-down", true);
      } else {
        this.bodySprite.stop();
      }
    }

    // 이전 상태와 비교 (State Change Detection)
    if (
      isMoving !== this.prevState.isMoving ||
      currentDirection !== this.prevState.direction
    ) {
      const payload = {
        roomId: this.roomId,
        userId: this.id,
        x: this.container.x,
        y: this.container.y,
        isMoving: isMoving,
        direction: currentDirection,
        timestamp: Date.now(),
      };

      // 실제 소켓 전송
      emitEvent("moving", payload);

      // 상태 업데이트
      this.prevState = {
        isMoving,
        direction: currentDirection,
      };
    }
  }

  // 위치 정보 반환 (소켓 전송용)
  getPosition() {
    return {
      x: this.container.x,
      y: this.container.y,
    };
  }

  // 접속 시간 업데이트
  updateTimer(minutes: number) {
    if (this.timerText) {
      this.timerText.setText(formatPlayTime(minutes));
    }
  }

  destroy() {
    this.container.destroy();
    this.maskShape.destroy();
  }

  getContainer() {
    return this.container;
  }
}
