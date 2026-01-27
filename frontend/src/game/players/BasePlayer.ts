import * as Phaser from "phaser";
import { formatFocusTime } from "@/utils/timeFormat";
import { MODAL_TYPES, useModalStore } from "@/stores/useModalStore";
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
  protected focusTimeText: Phaser.GameObjects.Text;
  protected borderGraphics: Phaser.GameObjects.Graphics;
  protected body: Phaser.Physics.Arcade.Body;
  protected bodyGlow: Phaser.FX.Glow | null = null;
  protected taskBubbleContainer: Phaser.GameObjects.Container | null = null;

  // Pet
  protected pet: Pet;

  public id: string;
  public username: string;
  public playerId: number = 0;

  protected speed: number = 300;

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

    // 8. 컨테이너 추가
    const containerChildren: Phaser.GameObjects.GameObject[] = [
      this.bodySprite,
      this.faceSprite,
      this.borderGraphics,
      nameTag,
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
      this.maskShape.x = this.container.x;
      this.maskShape.y = this.container.y;
    }
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
    this.pet.destroy();
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

  // 펫 이미지 동적 로딩 및 설정
  setPet(imageUrl: string | null) {
    if (!imageUrl) {
      // 이미지가 없으면 펫 제거
      this.pet.destroy();
      return;
    }

    const fileName = imageUrl.split("/").pop();
    if (!fileName) {
      console.warn("[BasePlayer] Invalid imageUrl format:", imageUrl);
      return;
    }
    const textureKey = `pet_${fileName}`;

    // 이미 로드된 텍스처면 바로 적용
    if (this.scene.textures.exists(textureKey)) {
      this.pet.setTexture(textureKey);
      return;
    }

    // 로드되지 않았다면 동적 로딩
    this.scene.load.image(textureKey, imageUrl);

    // 로드 에러 처리
    const errorListener = (file: Phaser.Loader.File) => {
      if (file.key === textureKey) {
        console.error(`[BasePlayer] Load error for ${textureKey}:`, file);
        this.scene.load.off("loaderror", errorListener);
      }
    };
    this.scene.load.on("loaderror", errorListener);

    this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
      this.pet.setTexture(textureKey);
      this.scene.load.off("loaderror", errorListener); // 성공 시 에러 리스너 제거
    });

    this.scene.load.start();
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

    // 상태에 따른 스타일 결정
    const statusText = isFocusing ? "작업 중" : "휴식 중";
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

    // 태스크명이 있으면 추가
    let taskLabel: Phaser.GameObjects.Text | null = null;
    const MAX_TASK_NAME_LENGTH = 15;
    if (isFocusing && taskName) {
      const displayTaskName =
        taskName.length > MAX_TASK_NAME_LENGTH
          ? taskName.slice(0, MAX_TASK_NAME_LENGTH) + "..."
          : taskName;
      taskLabel = this.scene.add.text(0, 0, displayTaskName, {
        fontFamily: "NeoDunggeunmo, Arial, sans-serif",
        fontSize: "12px",
        color: "#374151",
      });
      taskLabel.setResolution(2);
      taskLabel.setOrigin(0.5, 0.5); // 가운데 정렬
      elements.push(taskLabel);
    }

    // 태그 배경 계산
    const paddingX = 8;
    const paddingY = 4;
    const dotSize = 5;
    const dotGap = 6;
    const taskPaddingX = 12; // 세부 작업 글씨 좌우 여백
    const statusWidth = dotSize + dotGap + statusLabel.width;
    const taskWidth = taskLabel ? taskLabel.width + taskPaddingX * 2 : 0;
    const width = Math.max(statusWidth, taskWidth) + paddingX * 2;
    const height = taskLabel ? 38 : 24;

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

    // 요소 위치 조정
    if (taskLabel) {
      // 2줄 레이아웃: 상태(위) + 태스크(아래)
      const statusY = -6;
      const taskY = 8;
      // "작업 중" 텍스트의 왼쪽 시작점 (dot 오른쪽)
      const statusTextLeftX = -width / 2 + paddingX + dotSize + dotGap;
      statusDot.fillCircle(
        -width / 2 + paddingX + dotSize / 2,
        statusY,
        dotSize / 2,
      );
      statusLabel.setPosition(statusTextLeftX, statusY);
      // task를 "작" 글자 왼쪽에 맞춤 (왼쪽 정렬)
      taskLabel.setOrigin(0, 0.5);
      taskLabel.setPosition(statusTextLeftX, taskY);
    } else {
      // 1줄 레이아웃: 상태만
      statusDot.fillCircle(-width / 2 + paddingX + dotSize / 2, 0, dotSize / 2);
      statusLabel.setPosition(-width / 2 + paddingX + dotSize + dotGap, 0);
    }

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
    const bubbleY = -40 - taskTagHeight;

    const bubbleContainer = this.scene.add.container(0, bubbleY);
    bubbleContainer.setName("chatBubble");

    // 텍스트 생성pnp
    const chatText = this.scene.add.text(0, 0, text, {
      fontFamily: "NeoDunggeunmo, Arial, sans-serif",
      fontSize: "14px",
      color: "#000000",
      wordWrap: { width: 150, useAdvancedWrap: true },
    });
    chatText.setResolution(2);
    chatText.setOrigin(0.5);

    // 말풍선 배경 (둥근 사각형 + 꼬리)
    const bounds = chatText.getBounds();
    const padding = 12;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding;
    const radius = 10; // 더 둥글게

    const bubbleGraphics = this.scene.add.graphics();
    // 다중 레이어 그림자 (더 부드럽고 자연스러운 효과)
    bubbleGraphics.fillStyle(0x000000, 0.02);
    bubbleGraphics.fillRoundedRect(
      -width / 2 + 5,
      -height / 2 + 5,
      width,
      height,
      radius,
    );
    bubbleGraphics.fillStyle(0x000000, 0.04);
    bubbleGraphics.fillRoundedRect(
      -width / 2 + 3,
      -height / 2 + 4,
      width,
      height,
      radius,
    );
    bubbleGraphics.fillStyle(0x000000, 0.08);
    bubbleGraphics.fillRoundedRect(
      -width / 2 + 1,
      -height / 2 + 2,
      width,
      height,
      radius,
    );
    // 메인 배경
    bubbleGraphics.fillStyle(0xffffff, 1);
    bubbleGraphics.lineStyle(1, 0xd1d5db, 1);
    bubbleGraphics.fillRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      radius,
    );
    bubbleGraphics.strokeRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      radius,
    );
    // 말풍선 꼬리 (더 작고 부드럽게)
    bubbleGraphics.fillStyle(0xffffff, 1);
    bubbleGraphics.fillTriangle(
      -4,
      height / 2 - 1,
      4,
      height / 2 - 1,
      0,
      height / 2 + 6,
    );
    // 꼬리 테두리
    bubbleGraphics.lineStyle(1.5, 0xe5e7eb, 1);
    bubbleGraphics.lineBetween(-4, height / 2, 0, height / 2 + 6);
    bubbleGraphics.lineBetween(4, height / 2, 0, height / 2 + 6);

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
}
