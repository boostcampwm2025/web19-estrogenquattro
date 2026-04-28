import * as Phaser from "phaser";
import i18next from "i18next";
import { formatFocusTime } from "@/utils/timeFormat";
import { MODAL_TYPES, useModalStore } from "@/stores/useModalStore";
import { DIRECTION } from "../constants/direction";
import {
  MAX_FOCUS_TASK_NAME_LENGTH,
  exceedsUtf8ByteLimit,
  truncateToUtf8Bytes,
} from "@/utils/textBytes";
import Pet from "./Pet";
import type { Direction } from "../types/direction";

export interface TaskBubbleState {
  isFocusing: boolean;
  taskName?: string;
}

export default class BasePlayer {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected bodySprite: Phaser.GameObjects.Sprite;
  protected faceSprite: Phaser.GameObjects.Image;
  protected maskShape: Phaser.GameObjects.Graphics;
  protected nameTag: Phaser.GameObjects.Text;
  protected focusTimeText: Phaser.GameObjects.Text;
  protected borderGraphics: Phaser.GameObjects.Graphics;
  protected body: Phaser.Physics.Arcade.Body;
  protected bodyGlow: Phaser.FX.Glow | null = null;
  protected shadowGraphics: Phaser.GameObjects.Graphics;
  protected jumpTween: Phaser.Tweens.Tween | null = null;
  protected isJumping: boolean = false;
  protected taskBubbleContainer: Phaser.GameObjects.Container | null = null;

  // Pet
  protected pet: Pet;

  public id: string;
  public username: string;
  public playerId: number = 0;

  protected speed: number = 300;
  protected facingDirection: Direction = DIRECTION.RIGHT;

  // destroy 체크 + 리스너 정리
  private isDestroyed: boolean = false;
  private equippedLangKey: string | null = null;
  private pendingLoaderListeners: Array<{
    event: string;
    callback: (file?: Phaser.Loader.File) => void;
  }> = [];
  private currentPetLoadVersion: number = 0;
  private petLoadingKeys: Set<string> = new Set();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    username: string,
    id: string,
    texture: string = "face",
    playerId: number = 0,
  ) {
    this.scene = scene;
    this.id = id;
    this.username = username;
    this.playerId = playerId;

    // 1. 컨테이너 생성
    this.container = scene.add.container(x, y);

    // 2. 몸통 스프라이트 생성
    this.bodySprite = scene.add.sprite(0, 5, "body");
    this.bodySprite.setFrame(0);
    this.bodySprite.setScale(0.512); // 125x125 → 64x64

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
    this.nameTag = scene.add
      .text(0, 50, username, {
        fontFamily: "NeoDunggeunmo, Arial, sans-serif",
        fontSize: "15px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setResolution(2);

    // 6. 집중 시간 표시 (닉네임 아래)
    this.focusTimeText = scene.add
      .text(0, 66, formatFocusTime(0), {
        fontFamily: "NeoDunggeunmo, Arial, sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 0.5 },
      })
      .setOrigin(0.5)
      .setResolution(2);

    // 7. 펫 생성
    this.pet = new Pet(scene, this.container);

    // 7.1. 그림자 생성
    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.fillStyle(0x000000, 0.3);
    this.shadowGraphics.fillEllipse(0, 32, 32, 10);

    // 8. 컨테이너 추가
    const containerChildren: Phaser.GameObjects.GameObject[] = [
      this.shadowGraphics,
      this.bodySprite,
      this.faceSprite,
      this.borderGraphics,
      this.nameTag,
      this.focusTimeText,
    ];
    this.container.add(containerChildren);

    // 9. 물리 엔진 설정
    this.container.setSize(FACE_RADIUS * 2, FACE_RADIUS * 3);
    scene.physics.world.enable(this.container);
    this.body = this.container.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.body.setSize(FACE_RADIUS * 2, FACE_RADIUS / 2);
    this.body.setOffset(0, 50);

    // 10. 인터랙션 설정 (클릭 시 모달 열기)
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 10, FACE_RADIUS * 2, FACE_RADIUS * 3),
      Phaser.Geom.Rectangle.Contains,
    );

    // Body Glow Effect 초기화 (비활성 상태로 시작)
    if (this.bodySprite.preFX) {
      this.bodyGlow = this.bodySprite.preFX.addGlow(0xffff00, 4, 0, false);
      this.bodyGlow.active = false;
    }

    this.container.on(
      "pointerdown",
      (
        pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        // DOM 요소 위에서 클릭된 경우 무시
        const nativeEvent = pointer.event;
        let clientX: number;
        let clientY: number;
        if (nativeEvent instanceof TouchEvent) {
          clientX = nativeEvent.touches[0]?.clientX ?? 0;
          clientY = nativeEvent.touches[0]?.clientY ?? 0;
        } else {
          clientX = nativeEvent.clientX;
          clientY = nativeEvent.clientY;
        }
        const element = document.elementFromPoint(clientX, clientY);
        if (element !== this.scene.game.canvas) {
          event.stopPropagation();
          return;
        }
        useModalStore.getState().openModal(MODAL_TYPES.USER_INFO, {
          playerId: this.playerId,
          username: this.username,
        });
      },
    );

    this.container.on("pointerover", () => {
      this.scene.game.canvas.style.cursor = "pointer";
      this.borderGraphics.clear();
      this.borderGraphics.lineStyle(3, 0xffff00, 1);
      this.borderGraphics.strokeCircle(0, FACE_Y_OFFSET, FACE_RADIUS);
      if (this.bodyGlow) this.bodyGlow.active = true;
    });

    this.container.on("pointerout", () => {
      this.scene.game.canvas.style.cursor = "default";
      this.borderGraphics.clear();
      this.borderGraphics.lineStyle(2, 0xffffff, 1);
      this.borderGraphics.strokeCircle(0, FACE_Y_OFFSET, FACE_RADIUS);
      if (this.bodyGlow) this.bodyGlow.active = false;
    });
  }

  // 공통 update 메서드 (마스크 위치 동기화)
  update() {
    if (this.container && this.maskShape) {
      this.maskShape.x = this.container.x + this.faceSprite.x;
      this.maskShape.y = this.container.y + this.faceSprite.y;
      //y 좌표가 클수록(더 아래에 있을수록) 앞에 그려지도록 depth 설정
      // 최소값을 0으로 설정하여 맵 이미지(depth: -1)보다 항상 앞에 표시
      this.container.setDepth(Math.max(0, this.container.y));
    }
  }

  triggerJump(): void {
    if (this.isDestroyed || this.isJumping) return;

    this.isJumping = true;
    this.jumpTween?.destroy();

    const originalBodyY = this.bodySprite.y;
    const originalFaceY = this.faceSprite.y;
    const originalBorderY = this.borderGraphics.y;
    const originalNameY = this.nameTag.y;
    const originalFocusY = this.focusTimeText.y;
    const originalShadowScaleX = this.shadowGraphics.scaleX;
    const originalShadowScaleY = this.shadowGraphics.scaleY;
    const originalShadowAlpha = this.shadowGraphics.alpha;

    this.jumpTween = this.scene.tweens.add({
      targets: [
        this.bodySprite,
        this.faceSprite,
        this.borderGraphics,
        this.nameTag,
        this.focusTimeText,
      ],
      y: "-=24",
      duration: 220,
      ease: "Quad.Out",
      yoyo: true,
      hold: 40,
      onComplete: () => {
        this.bodySprite.y = originalBodyY;
        this.faceSprite.y = originalFaceY;
        this.borderGraphics.y = originalBorderY;
        this.nameTag.y = originalNameY;
        this.focusTimeText.y = originalFocusY;
        this.shadowGraphics.scaleX = originalShadowScaleX;
        this.shadowGraphics.scaleY = originalShadowScaleY;
        this.shadowGraphics.alpha = originalShadowAlpha;
        this.isJumping = false;
      },
    });

    this.scene.tweens.add({
      targets: this.shadowGraphics,
      scaleX: originalShadowScaleX * 0.74,
      scaleY: originalShadowScaleY * 0.74,
      alpha: originalShadowAlpha * 0.55,
      duration: 220,
      ease: "Quad.Out",
      yoyo: true,
      hold: 40,
    });
  }

  setFacingDirection(direction: Direction): void {
    if (direction !== DIRECTION.STOP) {
      this.facingDirection = direction;
    }
  }

  getFacingDirection(): Direction {
    return this.facingDirection;
  }

  throwMacbook(
    direction: Direction = this.facingDirection,
    langKeyOverride?: string | null,
  ): void {
    if (this.isDestroyed) return;

    const normalizedDirection =
      direction === DIRECTION.STOP ? this.facingDirection : direction;
    const { dx, dy, angle } = this.getThrowVector(normalizedDirection);
    const startX = this.container.x + dx * 12;
    const startY = this.container.y - 4 + dy * 8;

    const resolvedLangKey =
      langKeyOverride !== undefined ? langKeyOverride : this.equippedLangKey;
    if (
      !resolvedLangKey ||
      !this.scene.textures.exists(`lang-${resolvedLangKey}`)
    )
      return;
    const textureKey = `lang-${resolvedLangKey}`;

    const macbook = this.scene.add.image(startX, startY, textureKey);

    macbook.setScale(0.72);
    macbook.setRotation(Phaser.Math.DegToRad(angle));
    macbook.setDepth(this.container.depth + 2);

    const travelDistance = 120;
    const targetX = startX + dx * travelDistance;
    const targetY = startY + dy * 18 - 8;

    this.scene.tweens.add({
      targets: macbook,
      x: targetX,
      y: targetY,
      angle: angle + dx * 120,
      duration: 520,
      ease: "Cubic.Out",
      onUpdate: (tween, target) => {
        const image = target as Phaser.GameObjects.Image;
        const progress = tween.progress;
        image.y =
          startY +
          (targetY - startY) * progress -
          Math.sin(progress * Math.PI) * 26;
        image.alpha = 1 - progress * 0.08;
      },
      onComplete: () => {
        this.scene.tweens.add({
          targets: macbook,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          duration: 140,
          onComplete: () => {
            macbook.destroy();
          },
        });
      },
    });
  }

  // 방향에 따른 펫 위치 업데이트
  updatePetPosition(direction: Direction) {
    this.pet.updatePosition(direction);
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

  // 플레이어 위치 재설정 (리스폰)
  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
    // 물리 바디도 함께 이동
    if (this.body) {
      this.body.reset(x, y);
    }
  }

  // 자원 해제
  destroy() {
    this.isDestroyed = true;

    // 대기 중인 로더 리스너 정리
    if (this.scene?.load) {
      this.pendingLoaderListeners.forEach(({ event, callback }) => {
        this.scene.load.off(event, callback);
      });
    }
    this.pendingLoaderListeners = [];
    this.petLoadingKeys.clear();

    this.jumpTween?.destroy();
    this.jumpTween = null;
    this.musicParticleEmitter?.destroy();
    this.clearEffects();
    this.pet.destroy();
    this.container.destroy();
    this.maskShape.destroy();
  }

  private getThrowVector(direction: Direction): {
    dx: number;
    dy: number;
    angle: number;
  } {
    switch (direction) {
      case DIRECTION.LEFT:
        return { dx: -1, dy: -0.1, angle: -24 };
      case DIRECTION.RIGHT:
        return { dx: 1, dy: -0.1, angle: 24 };
      case DIRECTION.UP:
        return { dx: 0, dy: -1, angle: -90 };
      case DIRECTION.DOWN:
        return { dx: 0, dy: 0.65, angle: 90 };
      case DIRECTION.LEFT_UP:
        return { dx: -0.75, dy: -0.55, angle: -48 };
      case DIRECTION.LEFT_DOWN:
        return { dx: -0.78, dy: 0.45, angle: 148 };
      case DIRECTION.RIGHT_UP:
        return { dx: 0.75, dy: -0.55, angle: 48 };
      case DIRECTION.RIGHT_DOWN:
        return { dx: 0.78, dy: 0.45, angle: 32 };
      case DIRECTION.STOP:
      default:
        return { dx: 1, dy: -0.1, angle: 24 };
    }
  }

  // 얼굴 텍스처 업데이트
  updateFaceTexture(texture: string) {
    if (this.isDestroyed) return;
    if (!this.faceSprite?.scene) return;

    if (this.scene.textures.exists(texture)) {
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

  // 펫 이미지 동적 로딩 및 설정
  setPet(imageUrl: string | null) {
    if (this.isDestroyed) return;

    // 버전 증가 (연속 호출 시 이전 로드 무효화)
    this.currentPetLoadVersion++;
    const thisLoadVersion = this.currentPetLoadVersion;

    if (!imageUrl) {
      // 이미지가 없으면 펫 제거 (clear로 재사용 가능하게)
      this.pet.clear();
      return;
    }

    // 텍스처 키: URL 해시 사용 (파일명 충돌 방지)
    const textureKey = `pet_${this.hashString(imageUrl)}`;

    // 이미 로드된 텍스처면 바로 적용
    if (this.scene.textures.exists(textureKey)) {
      this.pet.setTexture(textureKey);
      return;
    }

    // 이미 로드 중인지 확인 (중복 로드 방지)
    const isAlreadyLoading = this.petLoadingKeys.has(textureKey);

    const cleanup = () => {
      this.petLoadingKeys.delete(textureKey);
      this.cleanupListener("loaderror", errorListener);
      this.cleanupListener(
        `filecomplete-image-${textureKey}`,
        completeListener,
      );
    };

    const errorListener = (file?: Phaser.Loader.File) => {
      if (file?.key === textureKey) {
        console.error(`[BasePlayer] Load error for ${textureKey}:`, file);
        cleanup();
      }
    };

    const completeListener = () => {
      cleanup();
      if (this.isDestroyed || thisLoadVersion !== this.currentPetLoadVersion)
        return;
      this.pet.setTexture(textureKey);
    };

    this.registerListener("loaderror", errorListener);
    this.registerListener(`filecomplete-image-${textureKey}`, completeListener);
    this.scene.load.on("loaderror", errorListener);
    this.scene.load.once(`filecomplete-image-${textureKey}`, completeListener);

    // 이미 로드 중이 아닐 때만 새 로드 시작
    if (!isAlreadyLoading) {
      this.petLoadingKeys.add(textureKey);
      this.scene.load.image(textureKey, imageUrl);

      if (!this.scene.load.isLoading()) {
        this.scene.load.start();
      }
    }
  }

  // 해시 헬퍼 (간단한 문자열 해시)
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private registerListener(
    event: string,
    callback: (file?: Phaser.Loader.File) => void,
  ) {
    this.pendingLoaderListeners.push({ event, callback });
  }

  private cleanupListener(
    event: string,
    callback: (file?: Phaser.Loader.File) => void,
  ) {
    if (this.scene?.load) {
      this.scene.load.off(event, callback);
    }
    this.pendingLoaderListeners = this.pendingLoaderListeners.filter(
      (l) => !(l.event === event && l.callback === callback),
    );
  }

  // 작업 상태 태그 표시 (항상 표시됨, 꼬리 없는 태그 스타일)
  updateTaskBubble(state: TaskBubbleState) {
    // 기존 작업 태그 제거
    if (this.taskBubbleContainer) {
      this.taskBubbleContainer.destroy();
      this.taskBubbleContainer = null;
    }

    const { isFocusing, taskName } = state;

    // 태그 컨테이너 생성 (플레이어 위)
    this.taskBubbleContainer = this.scene.add.container(0, -40);
    this.taskBubbleContainer.setName("taskBubble");

    // 상태에 따른 스타일 및 텍스트 결정
    let statusText = isFocusing
      ? (i18next.t as unknown as (k: string, o: { ns: string }) => string)(
          "status.focusing",
          { ns: "game" },
        )
      : (i18next.t as unknown as (k: string, o: { ns: string }) => string)(
          "status.resting",
          { ns: "game" },
        );
    if (isFocusing && taskName) {
      statusText = exceedsUtf8ByteLimit(taskName, MAX_FOCUS_TASK_NAME_LENGTH)
        ? `${truncateToUtf8Bytes(taskName, MAX_FOCUS_TASK_NAME_LENGTH)}...`
        : taskName;
    }

    // 작업 중: 초록 계열 / 휴식중: 빨강 계열
    const bgColor = isFocusing ? 0xdcfce7 : 0xfee2e2;
    const borderColor = isFocusing ? 0x86efac : 0xfca5a5;
    const dotColor = isFocusing ? 0x22c55e : 0xef4444;
    const textColor = isFocusing ? "#166534" : "#991b1b";

    const elements: Phaser.GameObjects.GameObject[] = [];

    // 상태 dot
    const statusDot = this.scene.add.graphics();
    statusDot.fillStyle(dotColor, 1);

    // 상태 텍스트
    const statusLabel = this.scene.add.text(0, 0, statusText, {
      fontFamily: "NeoDunggeunmo, Arial, sans-serif",
      fontSize: "13px",
      color: textColor,
    });
    statusLabel.setResolution(2);
    statusLabel.setOrigin(0, 0.5);
    elements.push(statusDot, statusLabel);

    // 태그 배경 계산
    const paddingX = 8;
    const dotSize = 5;
    const dotGap = 6;
    const statusWidth = dotSize + dotGap + statusLabel.width;
    const width = statusWidth + paddingX * 2;
    const height = 24;

    // 태그 배경 (꼬리 없음, 둥근 사각형)
    const tagGraphics = this.scene.add.graphics();
    tagGraphics.fillStyle(bgColor, 1);
    tagGraphics.lineStyle(1, borderColor, 1);
    tagGraphics.fillRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      height / 2,
    );
    tagGraphics.strokeRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      height / 2,
    );

    // 요소 위치 조정 (1줄 레이아웃)
    statusDot.fillCircle(-width / 2 + paddingX + dotSize / 2, 0, dotSize / 2);
    statusLabel.setPosition(-width / 2 + paddingX + dotSize + dotGap, 0);

    this.taskBubbleContainer.add([tagGraphics, ...elements]);
    this.container.add(this.taskBubbleContainer);
    this.container.bringToTop(this.taskBubbleContainer);
  }

  // 채팅 말풍선 표시
  showChatBubble(text: string) {
    // 기존 말풍선 제거
    const existingBubble = this.container.getByName("chatBubble");
    if (existingBubble) {
      existingBubble.destroy();
    }

    // 작업 태그 위에 채팅 말풍선 배치 (태그 높이 + 여백)
    const taskTagHeight = this.taskBubbleContainer ? 40 : 0;
    const bubbleY = -20 - taskTagHeight;

    const bubbleContainer = this.scene.add.container(0, bubbleY);
    bubbleContainer.setName("chatBubble");

    const padding = 8;
    const tailHeight = 6;

    // 텍스트 생성
    const chatText = this.scene.add.text(0, -tailHeight - padding, text, {
      fontFamily: "NeoDunggeunmo, Arial, sans-serif",
      fontSize: "14px",
      color: "#000000",
      wordWrap: { width: 150, useAdvancedWrap: true },
    });
    chatText.setResolution(2);
    // 텍스트의 중심이 아닌, 하단 중심을 기준으로 배치
    chatText.setOrigin(0.5, 1);

    // 말풍선 배경 (둥근 사각형 + 꼬리)
    const bounds = chatText.getBounds();
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;
    const radius = 10;

    // 말풍선 본체 (위쪽으로 그려짐)
    const rectX = -width / 2;
    const rectY = -tailHeight - height;

    const bubbleGraphics = this.scene.add.graphics();
    // 다중 레이어 그림자
    bubbleGraphics.fillStyle(0x000000, 0.02);
    bubbleGraphics.fillRoundedRect(rectX + 5, rectY + 5, width, height, radius);
    bubbleGraphics.fillStyle(0x000000, 0.04);
    bubbleGraphics.fillRoundedRect(rectX + 3, rectY + 4, width, height, radius);
    bubbleGraphics.fillStyle(0x000000, 0.08);
    bubbleGraphics.fillRoundedRect(rectX + 1, rectY + 2, width, height, radius);

    // 메인 배경
    bubbleGraphics.fillStyle(0xffffff, 1);
    bubbleGraphics.lineStyle(1, 0xd1d5db, 1);
    bubbleGraphics.fillRoundedRect(rectX, rectY, width, height, radius);
    bubbleGraphics.strokeRoundedRect(rectX, rectY, width, height, radius);

    // 말풍선 꼬리 (아래쪽으로 뾰족하게)
    // 꼬리 시작점: (0, -tailHeight) -> 여기서 아래로 (0, 0)까지
    bubbleGraphics.fillStyle(0xffffff, 1);
    // 삼각형: 좌상(-4, -tailHeight), 우상(4, -tailHeight), 하단(0, 0)
    bubbleGraphics.fillTriangle(-4, -tailHeight, 4, -tailHeight, 0, 0);

    // 꼬리 테두리 (V자 형태)
    bubbleGraphics.lineStyle(1.5, 0xe5e7eb, 1);
    bubbleGraphics.beginPath();
    bubbleGraphics.moveTo(-4, -tailHeight);
    bubbleGraphics.lineTo(0, 0);
    bubbleGraphics.lineTo(4, -tailHeight);
    bubbleGraphics.strokePath();

    bubbleGraphics.lineStyle(2, 0xffffff, 1);
    bubbleGraphics.lineBetween(-3, -tailHeight, 3, -tailHeight);

    bubbleContainer.add([bubbleGraphics, chatText]);
    this.container.add(bubbleContainer);

    // 5초 후 제거
    this.scene.time.delayedCall(5000, () => {
      if (bubbleContainer.active) {
        bubbleContainer.destroy();
      }
    });

    // 채팅 말풍선이 맨 위에 오도록 설정
    this.container.bringToTop(bubbleContainer);
    // 작업 태그는 채팅 아래에 위치
    if (this.taskBubbleContainer) {
      this.container.bringToTop(this.taskBubbleContainer);
    }
  }

  // 음악 파티클 이미터
  protected musicParticleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // 이펙트
  private sparkleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireEmitterOuter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private electricSparkEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private electricGraphics?: Phaser.GameObjects.Graphics;
  private electricTimer?: Phaser.Time.TimerEvent;

  private ensureFlameTexture(): void {
    const key = "fx-flame";
    if (this.scene.textures.exists(key)) return;
    const w = 14;
    const h = 22;
    const canvas = this.scene.textures.createCanvas(key, w, h);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const cx = w / 2;
    // 불꽃 모양: 아래가 넓고 위로 갈수록 뾰족해지는 눈물 방울
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.bezierCurveTo(cx + w * 0.65, h * 0.35, cx + w * 0.5, h * 0.72, cx, h);
    ctx.bezierCurveTo(cx - w * 0.5, h * 0.72, cx - w * 0.65, h * 0.35, cx, 0);
    ctx.closePath();
    // 밑(뜨거운 부분)이 밝고 끝(식는 부분)이 투명해지는 그라디언트
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, "rgba(255,255,200,1)");
    grad.addColorStop(0.25, "rgba(255,200,0,1)");
    grad.addColorStop(0.6, "rgba(255,80,0,0.9)");
    grad.addColorStop(1, "rgba(180,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fill();
    canvas.refresh();
  }

  private ensureStarTexture(): void {
    const key = "fx-star";
    if (this.scene.textures.exists(key)) return;
    const size = 16;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? cx : cx * 0.4;
      const x = cx + r * Math.cos(angle - Math.PI / 2);
      const y = cy + r * Math.sin(angle - Math.PI / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    canvas.refresh();
  }

  private clearEffects(): void {
    this.sparkleEmitter?.destroy();
    this.sparkleEmitter = undefined;
    this.fireEmitter?.destroy();
    this.fireEmitter = undefined;
    this.fireEmitterOuter?.destroy();
    this.fireEmitterOuter = undefined;
    this.electricSparkEmitter?.destroy();
    this.electricSparkEmitter = undefined;
    this.electricGraphics?.destroy();
    this.electricGraphics = undefined;
    this.electricTimer?.destroy();
    this.electricTimer = undefined;
  }

  setEquippedLang(key: string | null): void {
    this.equippedLangKey = key;
  }

  setEffect(effectId: string | null): void {
    if (this.isDestroyed) return;
    this.clearEffects();
    if (effectId === "sparkle") this.startSparkle();
    else if (effectId === "electric") this.startElectric();
    else if (effectId === "fire") this.startFire();
  }

  private startSparkle(): void {
    this.ensureStarTexture();
    if (!this.scene.textures.exists("fx-star")) return;
    this.sparkleEmitter = this.scene.add.particles(0, 0, "fx-star", {
      speed: { min: 15, max: 50 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 700, max: 1400 },
      frequency: 185,
      quantity: 1,
      tint: [0xffd700, 0xffffff, 0xffe066, 0xaad4ff],
      follow: this.container,
      followOffset: { x: 0, y: -16 },
      emitZone: {
        type: "random" as const,
        source: new Phaser.Geom.Circle(0, 0, 40),
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
    this.sparkleEmitter.setDepth(this.container.depth + 3);
  }

  private startFire(): void {
    this.ensureFlameTexture();
    if (!this.scene.textures.exists("fx-flame")) return;

    // 좌우로 넓은 방사 존 — 캐릭터 양옆 커버
    const makeZone = (w: number) =>
      ({
        type: "random" as const,
        source: new Phaser.Geom.Ellipse(0, 0, w, 8),
      }) as Phaser.Types.GameObjects.Particles.EmitZoneData;

    // 내부 코어: 밝고 빠름, 양옆에서 수직 상승
    this.fireEmitter = this.scene.add.particles(0, 0, "fx-flame", {
      speed: { min: 55, max: 100 },
      angle: { min: 255, max: 285 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 400, max: 650 },
      frequency: 65,
      quantity: 1,
      rotate: { min: -25, max: 25 },
      follow: this.container,
      followOffset: { x: 0, y: 8 },
      emitZone: makeZone(56),
    });
    this.fireEmitter.setDepth(this.container.depth - 1);

    // 외부 오라: 더 넓고 느리며 붉은 색조
    this.fireEmitterOuter = this.scene.add.particles(0, 0, "fx-flame", {
      speed: { min: 30, max: 60 },
      angle: { min: 248, max: 292 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.55, end: 0 },
      lifespan: { min: 600, max: 950 },
      frequency: 100,
      quantity: 1,
      tint: [0xff3300, 0xff5500, 0xcc2200],
      rotate: { min: -35, max: 35 },
      follow: this.container,
      followOffset: { x: 0, y: 12 },
      emitZone: makeZone(70),
    });
    this.fireEmitterOuter.setDepth(this.container.depth - 2);
  }

  private ensureSparkTexture(): void {
    const key = "fx-spark";
    if (this.scene.textures.exists(key)) return;
    const canvas = this.scene.textures.createCanvas(key, 6, 6);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(2, 0, 2, 6);
    ctx.fillRect(0, 2, 6, 2);
    canvas.refresh();
  }

  private drawZigzag(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const segments = 5;
    const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = (Math.random() - 0.5) * 18;
      pts.push({
        x: x1 + (x2 - x1) * t + jitter,
        y: y1 + (y2 - y1) * t + jitter,
      });
    }
    pts.push({ x: x2, y: y2 });
    // 글로우
    g.lineStyle(4, 0x4488ff, 0.25);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => g.lineTo(p.x, p.y));
    g.strokePath();
    // 코어
    g.lineStyle(1.5, 0xcceeff, 0.95);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => g.lineTo(p.x, p.y));
    g.strokePath();
  }

  private startElectric(): void {
    this.ensureSparkTexture();

    // 주변 튀는 전기 스파크 파티클
    if (this.scene.textures.exists("fx-spark")) {
      this.electricSparkEmitter = this.scene.add.particles(0, 0, "fx-spark", {
        speed: { min: 50, max: 120 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 80, max: 220 },
        frequency: 115,
        quantity: 1,
        tint: [0xffffff, 0x88ccff, 0xaaddff, 0xffff99],
        follow: this.container,
        emitZone: {
          type: "random" as const,
          source: new Phaser.Geom.Circle(0, 0, 32),
        } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      });
      this.electricSparkEmitter.setDepth(this.container.depth + 3);
    }

    // 번개 아크 그래픽
    this.electricGraphics = this.scene.add.graphics();
    this.electricGraphics.setDepth(this.container.depth + 2);

    // 불규칙한 타이밍으로 번개 아크 그리기
    const scheduleNext = () => {
      if (this.isDestroyed || !this.electricTimer) return;
      const delay = Phaser.Math.Between(170, 460);
      this.electricTimer = this.scene.time.delayedCall(delay, () => {
        if (this.isDestroyed || !this.electricGraphics) return;
        const g = this.electricGraphics;
        const cx = this.container.x;
        const cy = this.container.y;
        const radius = 36;
        g.clear();
        g.setAlpha(1);
        const boltCount = Phaser.Math.Between(1, 3);
        for (let i = 0; i < boltCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          this.drawZigzag(
            g,
            cx,
            cy,
            cx + Math.cos(angle) * radius,
            cy + Math.sin(angle) * radius,
          );
        }
        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          duration: 90,
          onComplete: () => {
            if (!this.isDestroyed && this.electricGraphics) {
              this.electricGraphics.clear();
              this.electricGraphics.setAlpha(1);
            }
          },
        });
        scheduleNext();
      });
    };

    this.electricTimer = this.scene.time.delayedCall(0, scheduleNext);
  }

  // 음악 재생 상태 설정
  setMusicStatus(isListening: boolean) {
    if (isListening) {
      if (!this.musicParticleEmitter) {
        // 이미터 생성 (아틀라스 사용)
        if (this.scene.textures.exists("music_notes_atlas")) {
          this.musicParticleEmitter = this.scene.add.particles(
            0,
            0,
            "music_notes_atlas",
            {
              frame: [0, 1, 2, 3], // 4가지 음표 중 랜덤 선택
              speed: { min: 20, max: 50 },
              angle: { min: 290, max: 340 }, // 오른쪽 위 대각선
              // 이미지 크기에 따라 스케일 조정 (Base: 32x32)
              scale: { start: 0.8, end: 0.8 },
              alpha: { start: 1, end: 0 },
              lifespan: 1500,
              frequency: 500,
              quantity: 1,
              follow: this.container,
              followOffset: { x: 20, y: 0 }, // 캐릭터 머리 위
            },
          );
          // 컨테이너보다 위에 그려지도록 depth 설정
          this.musicParticleEmitter.setDepth(this.container.depth + 1);
        } else {
          console.warn("[BasePlayer] music_notes_atlas texture not found");
        }
      }
      this.musicParticleEmitter?.start();
    } else {
      this.musicParticleEmitter?.stop();
    }
  }

  // 자원 해제 오버라이드 시 emit destroy 호출 필요
  // BasePlayer destroy에 추가
}
