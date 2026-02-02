import * as Phaser from "phaser";
import Player from "../players/Player";
import { getSocket } from "../../lib/socket";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
import { useTasksStore } from "@/stores/useTasksStore";
import { useProgressStore } from "@/stores/useProgressStore";
import MapManager, { MapConfig } from "../managers/MapManager";
import SocketManager from "../managers/SocketManager";
import ChatManager from "../managers/ChatManager";
import CameraController from "../controllers/CameraController";
import { API_URL } from "@/lib/api/client";

export class MapScene extends Phaser.Scene {
  private player?: Player;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private username: string = "";
  private playerId: number = 0;

  // Managers & Controllers
  private mapManager!: MapManager;
  private socketManager!: SocketManager;
  private chatManager!: ChatManager;
  private cameraController!: CameraController;

  // Map Configuration
  // imagePath: 백엔드 API로 서빙 (권한 체크 적용)
  private maps: MapConfig[] = [
    {
      image: "tiles1",
      tilemap: "tilemap1",
      imagePath: `${API_URL}/api/maps/0`,
      tilemapPath: "/assets/tilemaps/desert_stage1.json",
    },
    {
      image: "tiles2",
      tilemap: "tilemap2",
      imagePath: `${API_URL}/api/maps/1`,
      tilemapPath: "/assets/tilemaps/desert_stage2.json",
    },
    {
      image: "tiles3",
      tilemap: "tilemap3",
      imagePath: `${API_URL}/api/maps/2`,
      tilemapPath: "/assets/tilemaps/desert_stage3.json",
    },
    {
      image: "tiles4",
      tilemap: "tilemap4",
      imagePath: `${API_URL}/api/maps/3`,
      tilemapPath: "/assets/tilemaps/desert_stage4.json",
    },
    {
      image: "tiles5",
      tilemap: "tilemap5",
      imagePath: `${API_URL}/api/maps/4`,
      tilemapPath: "/assets/tilemaps/desert_stage5.json",
    },
  ];

  constructor() {
    super({ key: "MogakcoScene" });
  }

  preload() {
    this.load.crossOrigin = "anonymous";

    // Tilemap(충돌 데이터)만 미리 로드
    // 맵 이미지는 game_state 수신 후 동적 로드 (권한 체크)
    this.maps.forEach((map) => {
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
    this.petImage = user?.petImage;
  }

  private petImage: string | null = null;

  create() {
    // 1. MapManager 생성 (맵 이미지는 game_state 수신 후 동적 로드)
    this.mapManager = new MapManager(this, this.maps);

    // React(Hooks)에서 보낸 펫 교체 이벤트 처리
    const handleLocalPetUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (this.player && customEvent.detail?.petImage) {
        this.player.setPet(customEvent.detail.petImage);
      }
    };
    window.addEventListener("local_pet_update", handleLocalPetUpdate);

    // 씬 종료 시 이벤트 리스너 제거
    this.events.once("destroy", () => {
      window.removeEventListener("local_pet_update", handleLocalPetUpdate);
    });

    // 2. Animations Setup (맵 독립적)
    this.createAnimations();

    // 3. Controls Setup (맵 독립적)
    this.setupControls();

    // 4. Socket Setup - game_state 수신 시 맵 로드 후 나머지 초기화
    this.socketManager = new SocketManager(
      this,
      this.username,
      () => this.player,
    );
    this.socketManager.connect({
      showSessionEndedOverlay: () => this.showSessionEndedOverlay(),
      onMapSwitch: (mapIndex) => this.performMapSwitch(mapIndex),
      onMapSyncRequired: (mapIndex) => this.performMapSwitch(mapIndex),
      onInitialMapLoad: (mapIndex) => this.initializeWithMap(mapIndex),
    });

    // 5. Chat Setup
    this.chatManager = new ChatManager(this, (message) =>
      this.socketManager.sendChat(message),
    );
    this.chatManager.setup();

    // 6. Cleanup on scene shutdown
    this.events.on("shutdown", this.cleanup, this);
  }

  /**
   * 첫 맵 로드 후 나머지 초기화 (game_state 수신 시 호출)
   */
  private initializeWithMap(mapIndex: number): void {
    // 서버에서 잘못된 mapIndex가 오면 방어
    if (mapIndex < 0 || mapIndex >= this.maps.length) {
      console.warn(
        `[MapScene] Invalid mapIndex from server: ${mapIndex}, using 0`,
      );
      mapIndex = 0;
    }
    this.mapManager.loadAndSetup(mapIndex, () => {
      // Player Setup
      this.setupPlayer();

      // Player 생성 후 joining 이벤트 emit
      this.socketManager.emitJoining();

      // Collisions Setup
      this.setupCollisions();

      // Camera Setup
      this.cameraController = new CameraController(this);
      const { width, height } = this.mapManager.getMapSize();
      this.cameraController.setup(width, height, this.player?.getContainer());

      // SocketManager에 walls 설정
      this.socketManager.setWalls(this.mapManager.getWalls()!);
    });
  }

  private cleanup(): void {
    this.cameraController?.destroy();
    this.events.off("shutdown", this.cleanup, this);
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
    // wall 피해 랜덤 스폰 위치
    const spawnPos = this.mapManager.getRandomSpawnPosition();

    const socket = getSocket();
    const myId = socket?.id || `guest-${Math.floor(Math.random() * 1000)}`;

    this.player = new Player(
      this,
      spawnPos.x,
      spawnPos.y,
      this.username,
      myId,
      "pending",
      this.playerId,
    );

    // 초기 펫 설정
    this.player.setRoomId("pending"); // 생성자에서 이미 설정하지만 명시적으로
    if (this.petImage) {
      this.player.setPet(this.petImage);
    }
  }

  private setupControls() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  /**
   * 맵 전환 공통 로직 (서버 map_switch/game_state 이벤트에서 호출)
   */
  private performMapSwitch(mapIndex: number) {
    this.mapManager.switchToMap(mapIndex, () => {
      this.setupCollisions();
      const { width, height } = this.mapManager.getMapSize();
      this.cameraController.updateBounds(width, height);
      this.socketManager.setWalls(this.mapManager.getWalls()!);
      this.socketManager.setupCollisions();

      // 플레이어 리스폰 (wall 피해 랜덤 위치) + 위치 동기화
      if (this.player) {
        const spawnPos = this.mapManager.getRandomSpawnPosition();
        this.player.setPosition(spawnPos.x, spawnPos.y);
        this.socketManager.sendRespawnPosition(spawnPos.x, spawnPos.y);
      }
    });
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

    // 집중 시간 업데이트 (타임스탬프 기반 계산)
    const focusTime = useFocusTimeStore.getState().getFocusTime();
    this.player.updateFocusTime(focusTime);

    // 작업 상태 말풍선 업데이트
    this.updateTaskBubble();

    // Player Update (방향키 + WASD 모두 전달)
    this.player.update(this.cursors, this.wasdKeys);

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
