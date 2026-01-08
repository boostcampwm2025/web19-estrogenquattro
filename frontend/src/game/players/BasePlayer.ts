import * as Phaser from "phaser";
import { formatFocusTime } from "@/utils/timeFormat";

export default class BasePlayer {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected bodySprite: Phaser.GameObjects.Sprite;
  protected faceSprite: Phaser.GameObjects.Image;
  protected maskShape: Phaser.GameObjects.Graphics;
  protected focusTimeText: Phaser.GameObjects.Text;
  protected borderGraphics: Phaser.GameObjects.Graphics;
  protected body: Phaser.Physics.Arcade.Body;

  public id: string;
  public username: string;

  protected speed: number = 300;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    texture: string = "face",
  ) {
    this.scene = scene;
    this.id = id;
    this.username = username;

    // 1. 컨테이너 생성
    this.container = scene.add.container(x, y);

    // 2. 몸통 스프라이트 생성
    this.bodySprite = scene.add.sprite(0, 5, "body");
    this.bodySprite.setFrame(0);

    // 3. 얼굴 & 마스크
    const FACE_RADIUS = 17;
    const FACE_Y_OFFSET = 0;

    this.maskShape = scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillCircle(0, 0, FACE_RADIUS);
    // 마스크 초기 위치를 컨테이너(플레이어) 위치로 설정
    this.maskShape.x = x;
    this.maskShape.y = y;
    const mask = this.maskShape.createGeometryMask();

    // 텍스처 로드 확인
    const faceTexture = scene.textures.exists(texture) ? texture : "face";
    this.faceSprite = scene.add.image(0, FACE_Y_OFFSET, faceTexture);
    this.faceSprite.setDisplaySize(FACE_RADIUS * 2, FACE_RADIUS * 2);
    this.faceSprite.setMask(mask);

    // 4. 테두리
    this.borderGraphics = scene.add.graphics();
    this.borderGraphics.lineStyle(2, 0xffffff, 1);
    this.borderGraphics.strokeCircle(0, FACE_Y_OFFSET, FACE_RADIUS);

    // 5. 닉네임 표시
    const nameTag = scene.add
      .text(0, 50, username, {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    // 6. 집중 시간 표시 (닉네임 아래)
    this.focusTimeText = scene.add
      .text(0, 66, formatFocusTime(0), {
        fontSize: "10px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    // 7. 컨테이너 추가
    this.container.add([
      this.bodySprite,
      this.faceSprite,
      this.borderGraphics,
      nameTag,
      this.focusTimeText,
    ]);

    // 8. 물리 엔진 설정
    this.container.setSize(FACE_RADIUS * 2, FACE_RADIUS * 3);
    scene.physics.world.enable(this.container);
    this.body = this.container.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.body.setSize(FACE_RADIUS * 2, FACE_RADIUS * 3);
    this.body.setOffset(0, 10);
  }

  // 공통 update 메서드 (마스크 위치 동기화)
  update() {
    if (this.container && this.maskShape) {
      this.maskShape.x = this.container.x;
      this.maskShape.y = this.container.y;
    }
  }

  // 집중 시간 업데이트
  updateFocusTime(seconds: number) {
    if (this.focusTimeText) {
      this.focusTimeText.setText(formatFocusTime(seconds));
    }
  }

  // 위치 반환
  getPosition() {
    return {
      x: this.container.x,
      y: this.container.y,
    };
  }

  // 컨테이너 반환
  getContainer() {
    return this.container;
  }

  // 자원 해제
  destroy() {
    this.container.destroy();
    this.maskShape.destroy();
  }

  // 얼굴 텍스처 업데이트
  updateFaceTexture(texture: string) {
    if (this.faceSprite && this.scene.textures.exists(texture)) {
      this.faceSprite.setTexture(texture);
      const FACE_RADIUS = 17;
      this.faceSprite.setDisplaySize(FACE_RADIUS * 2, FACE_RADIUS * 2);
    }
  }

  // 애니메이션 재생 헬퍼함수
  playAnimation(animationKey: string, ignoreIfPlaying: boolean = true) {
    if (this.bodySprite) {
      this.bodySprite.play(animationKey, ignoreIfPlaying);
    }
  }

  stopAnimation() {
    if (this.bodySprite) {
      this.bodySprite.stop();
    }
  }

  // 말풍선 표시
  showChatBubble(text: string) {
    // 기존 말풍선 제거
    const existingBubble = this.container.getByName("chatBubble");
    if (existingBubble) {
      existingBubble.destroy();
    }

    const bubbleContainer = this.scene.add.container(0, -70);
    bubbleContainer.setName("chatBubble");

    // 텍스트 생성
    const chatText = this.scene.add.text(0, 0, text, {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      color: "#000000",
      wordWrap: { width: 150, useAdvancedWrap: true },
    });
    chatText.setOrigin(0.5);

    // 말풍선 배경 (둥근 사각형 + 꼬리)
    const bounds = chatText.getBounds();
    const padding = 10;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;

    const bubbleGraphics = this.scene.add.graphics();
    bubbleGraphics.fillStyle(0xffffff, 1);
    bubbleGraphics.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    // 말풍선 꼬리
    bubbleGraphics.fillTriangle(
      -5,
      height / 2,
      5,
      height / 2,
      0,
      height / 2 + 8,
    );

    bubbleContainer.add([bubbleGraphics, chatText]);
    this.container.add(bubbleContainer);

    // 5초 후 제거
    this.scene.time.delayedCall(5000, () => {
      if (bubbleContainer.active) {
        bubbleContainer.destroy();
      }
    });

    // 말풍선이 맨 위에 오도록 설정
    this.container.bringToTop(bubbleContainer);
  }
}
