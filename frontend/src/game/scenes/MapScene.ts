import * as Phaser from "phaser";
import Player from "../players/Player";
import { getSocket } from "../../lib/socket";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
import { useTasksStore } from "@/stores/useTasksStore";

import {
  createProgressBar,
  ProgressBarController,
} from "@/game/ui/createProgressBar";
import {
  createContributionList,
  ContributionController,
} from "@/game/ui/createContributionList";
import MapManager, { MapConfig } from "../managers/MapManager";
import SocketManager from "../managers/SocketManager";
import ChatManager from "../managers/ChatManager";
import CameraController from "../controllers/CameraController";

export type { ProgressBarController, ContributionController };

export class MapScene extends Phaser.Scene {
  private player?: Player;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private xKey?: Phaser.Input.Keyboard.Key;
  private username: string = "";
  private playerId: number = 0;

  // Managers & Controllers
  private mapManager!: MapManager;
  private socketManager!: SocketManager;
  private chatManager!: ChatManager;
  private cameraController!: CameraController;

  // UI Controllers
  private progressBarController?: ProgressBarController;
  private contributionController?: ContributionController;

  // Connection Lost Overlay
  private connectionLostOverlay?: Phaser.GameObjects.Rectangle;
  private connectionLostText?: Phaser.GameObjects.Text;

  // Map Configuration
  private maps: MapConfig[] = [
    {
      image: "tiles1",
      tilemap: "tilemap1",
      imagePath: "/assets/maps/dessert_stage1.webp",
      tilemapPath: "/assets/tilemaps/dessert_stage1.json",
    },
    {
      image: "tiles2",
      tilemap: "tilemap2",
      imagePath: "/assets/maps/dessert_stage2.webp",
      tilemapPath: "/assets/tilemaps/dessert_stage2.json",
    },
    {
      image: "tiles3",
      tilemap: "tilemap3",
      imagePath: "/assets/maps/dessert_stage3.webp",
      tilemapPath: "/assets/tilemaps/dessert_stage3.json",
    },
    {
      image: "tiles4",
      tilemap: "tilemap4",
      imagePath: "/assets/maps/dessert_stage4.webp",
      tilemapPath: "/assets/tilemaps/dessert_stage4.json",
    },
    {
      image: "tiles5",
      tilemap: "tilemap5",
      imagePath: "/assets/maps/dessert_stage5.webp",
      tilemapPath: "/assets/tilemaps/dessert_stage5.json",
    },
  ];

  constructor() {
    super({ key: "MogakcoScene" });
  }

  preload() {
    this.load.crossOrigin = "anonymous";

    // Load all maps dynamically
    this.maps.forEach((map) => {
      this.load.image(map.image, map.imagePath);
      if (map.tilemapPath) {
        this.load.tilemapTiledJSON(map.tilemap, map.tilemapPath);
      }
    });

    // Body Sprite Sheet
    this.load.spritesheet("body", "/assets/body.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    // Default Face
    const username = this.username || "boostcampwm2025";
    this.load.image(
      "face",
      `https://avatars.githubusercontent.com/${username}`,
    );

    // Pet
    this.load.svg("pet", "/assets/mascot/gopher_stage1.svg", {
      width: 512,
      height: 512,
    });
  }

  init() {
    const user = this.registry.get("user");
    this.username = user?.username;
    this.playerId = user?.playerId ?? 0;
  }

  create() {
    // 1. Map Setup
    this.mapManager = new MapManager(this, this.maps);
    this.mapManager.setup();

    // 2. Animations Setup
    this.createAnimations();

    // 3. Player Setup
    this.setupPlayer();

    // 4. Collisions Setup
    this.setupCollisions();

    // 5. Controls Setup
    this.setupControls();

    // 6. UI Setup
    this.setupUI();

    // 7. Camera Setup
    this.cameraController = new CameraController(this);
    const { width, height } = this.mapManager.getMapSize();
    this.cameraController.setup(width, height, this.player?.getContainer());

    // 8. Socket Setup
    this.socketManager = new SocketManager(
      this,
      this.username,
      () => this.player,
    );
    this.socketManager.setWalls(this.mapManager.getWalls()!);
    this.socketManager.setProgressBarController(this.progressBarController!);
    this.socketManager.setContributionController(this.contributionController!);
    this.socketManager.connect({
      showSessionEndedOverlay: () => this.showSessionEndedOverlay(),
      showConnectionLostOverlay: () => this.showConnectionLostOverlay(),
      hideConnectionLostOverlay: () => this.hideConnectionLostOverlay(),
    });

    // 9. Chat Setup
    this.chatManager = new ChatManager(this, (message) =>
      this.socketManager.sendChat(message),
    );
    this.chatManager.setup();
  }

  private createAnimations() {
    const FRAME_RATE = 10;

    if (!this.anims.exists("walk-down")) {
      this.anims.create({
        key: "walk-down",
        frames: this.anims.generateFrameNumbers("body", { start: 0, end: 3 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }

    if (!this.anims.exists("walk-left")) {
      this.anims.create({
        key: "walk-left",
        frames: this.anims.generateFrameNumbers("body", { start: 4, end: 7 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }

    if (!this.anims.exists("walk-right")) {
      this.anims.create({
        key: "walk-right",
        frames: this.anims.generateFrameNumbers("body", { start: 8, end: 11 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }

    if (!this.anims.exists("walk-up")) {
      this.anims.create({
        key: "walk-up",
        frames: this.anims.generateFrameNumbers("body", { start: 12, end: 15 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }
  }

  private setupPlayer() {
    const { width: mapWidth, height: mapHeight } = this.mapManager.getMapSize();
    const tileSize = this.mapManager.getTileSize();

    const startX =
      Math.floor(mapWidth / 2 / tileSize) * tileSize + tileSize / 2;
    const startY =
      Math.floor(mapHeight / 2 / tileSize) * tileSize + tileSize / 2;

    const socket = getSocket();
    const myId = socket?.id || `guest-${Math.floor(Math.random() * 1000)}`;

    this.player = new Player(
      this,
      startX,
      startY,
      this.username,
      myId,
      "pending",
      this.playerId,
    );
  }

  private setupControls() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.xKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    }
  }

  private setupUI() {
    const { width: mapWidth } = this.mapManager.getMapSize();

    if (this.progressBarController) {
      this.progressBarController.destroy();
    }
    if (this.contributionController) {
      this.contributionController.destroy();
    }

    this.progressBarController = createProgressBar(this, mapWidth);

    this.progressBarController.onProgressComplete = () => {
      this.mapManager.switchToNextMap(() => {
        this.setupCollisions();
        this.setupUI();
        const { width, height } = this.mapManager.getMapSize();
        this.cameraController.updateBounds(width, height);
        this.socketManager.setWalls(this.mapManager.getWalls()!);
        this.socketManager.setupCollisions();
        this.socketManager.setProgressBarController(
          this.progressBarController!,
        );
        this.socketManager.setContributionController(
          this.contributionController!,
        );
      });
    };

    this.contributionController = createContributionList(this, mapWidth, 50);
  }

  private setupCollisions() {
    const walls = this.mapManager.getWalls();
    if (walls && this.player) {
      this.physics.add.collider(this.player.getContainer(), walls);
    }
  }

  private showSessionEndedOverlay() {
    this.scene.pause();

    const overlay = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7,
    );
    overlay.setScrollFactor(0);
    overlay.setDepth(1000);

    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      "다른 탭에서 접속하여\n현재 세션이 종료되었습니다.",
      {
        fontSize: "24px",
        color: "#ffffff",
        align: "center",
      },
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(1001);
  }

  private showConnectionLostOverlay() {
    // 이미 표시 중이면 무시
    if (this.connectionLostOverlay) return;

    this.connectionLostOverlay = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7,
    );
    this.connectionLostOverlay.setScrollFactor(0);
    this.connectionLostOverlay.setDepth(1000);

    this.connectionLostText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      "서버와의 연결이 끊어졌습니다.\n재연결 시도 중...",
      {
        fontSize: "24px",
        color: "#ffffff",
        align: "center",
      },
    );
    this.connectionLostText.setOrigin(0.5);
    this.connectionLostText.setScrollFactor(0);
    this.connectionLostText.setDepth(1001);
  }

  private hideConnectionLostOverlay() {
    if (this.connectionLostOverlay) {
      this.connectionLostOverlay.destroy();
      this.connectionLostOverlay = undefined;
    }
    if (this.connectionLostText) {
      this.connectionLostText.destroy();
      this.connectionLostText = undefined;
    }
  }

  update() {
    if (!this.player || !this.cursors) return;

    // 테스트: X 키로 게이지 100% 채우기
    if (this.xKey && Phaser.Input.Keyboard.JustDown(this.xKey)) {
      const currentProgress = this.progressBarController?.getProgress() || 0;
      const remaining = 100 - currentProgress;
      if (remaining > 0) {
        this.progressBarController?.addProgress(remaining);
      }
    }

    // 집중 시간 업데이트
    const focusTime = useFocusTimeStore.getState().focusTime;
    this.player.updateFocusTime(focusTime);

    // 작업 상태 말풍선 업데이트
    this.updateTaskBubble();

    // Player Update
    this.player.update(this.cursors);

    // Remote Players Update
    this.socketManager.updateRemotePlayers();
  }

  // 작업 상태 말풍선 업데이트 (상태 변경 시에만)
  private lastTaskBubbleState: {
    isFocusing: boolean;
    taskName?: string;
  } | null = null;

  updateTaskBubble() {
    if (!this.player) return;

    const { isFocusTimerRunning } = useFocusTimeStore.getState();
    const tasks = useTasksStore.getState().tasks;
    const runningTask = tasks.find((task) => task.isRunning);

    // 타이머가 돌아가고 있는지 확인 (전체 or 개별)
    const isFocusing = isFocusTimerRunning || !!runningTask;
    const taskName = runningTask?.description;

    // 상태가 변경되었을 때만 업데이트
    const currentState = { isFocusing, taskName };
    if (
      this.lastTaskBubbleState?.isFocusing === currentState.isFocusing &&
      this.lastTaskBubbleState?.taskName === currentState.taskName
    ) {
      return;
    }

    this.lastTaskBubbleState = currentState;
    this.player.updateTaskBubble({ isFocusing, taskName });
  }
}
