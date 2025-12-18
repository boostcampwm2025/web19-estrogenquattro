import * as Phaser from "phaser";

export default class RemotePlayer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private body: Phaser.Physics.Arcade.Body;
  private maskShape: Phaser.GameObjects.Graphics;
  private faceSprite: Phaser.GameObjects.Image;
  public id: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    texture: string, // 유저네임(텍스처 키) 받기
  ) {
    this.scene = scene;
    this.id = id;

    // 1. 컨테이너 생성
    this.container = scene.add.container(x, y);

    // 2. 얼굴 & 마스크
    const FACE_RADIUS = 20;
    const FACE_Y_OFFSET = 0;

    this.maskShape = scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillCircle(0, 0, FACE_RADIUS);
    // 마스크 초기 위치를 컨테이너(플레이어) 위치로 설정
    this.maskShape.x = x;
    this.maskShape.y = y;
    const mask = this.maskShape.createGeometryMask();

    // 텍스처가 로드되어 있는지 확인하고, 없으면 기본값 'face'
    const faceTexture = scene.textures.exists(texture) ? texture : "face";
    this.faceSprite = scene.add.image(0, FACE_Y_OFFSET, faceTexture);

    this.faceSprite.setDisplaySize(FACE_RADIUS * 2, FACE_RADIUS * 2);
    this.faceSprite.setMask(mask);

    // 4. 테두리
    const borderGraphics = scene.add.graphics();
    borderGraphics.lineStyle(4, 0xffffff, 1);
    borderGraphics.strokeCircle(0, FACE_Y_OFFSET, FACE_RADIUS);

    // 5. 닉네임 표시
    /*  const nameTag = scene.add
      .text(0, -70, username, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5); */

    // 6. 컨테이너 추가
    this.container.add([this.faceSprite, borderGraphics]);
    this.container.setSize(FACE_RADIUS * 2, FACE_RADIUS * 2);

    // 7. 물리 엔진 적용
    scene.physics.world.enable(this.container);
    this.body = this.container.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
  }

  // 얼굴 텍스처 업데이트
  updateFaceTexture(texture: string) {
    if (this.faceSprite && this.scene.textures.exists(texture)) {
      this.faceSprite.setTexture(texture);
      const FACE_RADIUS = 20;
      this.faceSprite.setDisplaySize(FACE_RADIUS * 2, FACE_RADIUS * 2);
    }
  }

  // 서버에서 받은 상태로 업데이트
  updateState(state: {
    x: number;
    y: number;
    isMoving: boolean;
    direction: string;
  }) {
    if (!this.body) {
      console.error("RemotePlayer body not found");
      return;
    }

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
    const SPEED = 300;
    this.body.setVelocity(0); // 일단 정지

    if (state.isMoving) {
      // 방향 문자열 파싱해서 속도 적용
      if (state.direction.includes("left")) this.body.setVelocityX(-SPEED);
      if (state.direction.includes("right")) this.body.setVelocityX(SPEED);
      if (state.direction.includes("up")) this.body.setVelocityY(-SPEED);
      if (state.direction.includes("down")) this.body.setVelocityY(SPEED);
    } else {
      // 멈췄을 때는 좌표 강제 동기화 (정확한 위치 안착)
      this.container.setPosition(state.x, state.y);
    }

    // 마스크 동기화 (update()에서 수행하므로 여기서는 제거해도 되지만, 안전을 위해 둠)
    if (this.maskShape) {
      this.maskShape.x = this.container.x;
      this.maskShape.y = this.container.y;
    }
  }

  // 매 프레임 호출되어 마스크 위치를 컨테이너와 동기화
  update() {
    if (this.container && this.maskShape) {
      this.maskShape.x = this.container.x;
      this.maskShape.y = this.container.y;
    }
  }

  destroy() {
    this.container.destroy();
    this.maskShape.destroy();
  }
}
