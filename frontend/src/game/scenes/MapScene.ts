import * as Phaser from "phaser";
import Player from "../players/Player";
import { getSocket } from "../../lib/socket";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
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
  private gridKey?: Phaser.Input.Keyboard.Key;
  private xKey?: Phaser.Input.Keyboard.Key;
  private username: string = "";

  // Managers & Controllers
  private mapManager!: MapManager;
  private socketManager!: SocketManager;
  private chatManager!: ChatManager;
  private cameraController!: CameraController;

  // UI Controllers
  private progressBarController?: ProgressBarController;
  private contributionController?: ContributionController;

  // Map Configuration
  private maps: MapConfig[] = [
    { image: "tiles1", tilemap: "tilemap1" },
    { image: "tiles2", tilemap: "tilemap2" },
  ];

  constructor() {
    super({ key: "MogakcoScene" });
  }

  preload() {
    this.load.crossOrigin = "anonymous";

    // Map 1
    this.load.image("tiles1", "/assets/tempMap1.png");
    this.load.tilemapTiledJSON("tilemap1", "/assets/temp1Tilemap.json");

    // Map 2
    this.load.image("tiles2", "/assets/tempMap2.png");
    this.load.tilemapTiledJSON("tilemap2", "/assets/temp2Tilemap.json");

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
    this.socketManager.connect(() => this.showSessionEndedOverlay());

    // 9. Grid Setup
    this.mapManager.drawGrid();

    // 10. Chat Setup
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
    );
  }

  private setupControls() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.gridKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.G,
      );
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

  update() {
    if (!this.player || !this.cursors) return;

    // Grid Toggle
    if (this.gridKey && Phaser.Input.Keyboard.JustDown(this.gridKey)) {
      this.mapManager.toggleGrid();
    }

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

    // Player Update
    this.player.update(this.cursors);

    // Remote Players Update
    this.socketManager.updateRemotePlayers();
  }
}
