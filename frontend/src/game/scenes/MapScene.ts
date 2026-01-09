import * as Phaser from "phaser";
import Player from "../players/Player";
import RemotePlayer from "../players/RemotePlayer";
import { connectSocket, getSocket } from "../../lib/socket";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";

interface PlayerData {
  userId: string;
  username?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  direction?: string;
  timestamp?: number;
}
import {
  createProgressBar,
  ProgressBarController,
} from "@/game/ui/createProgressBar";
import {
  createContributionList,
  ContributionController,
} from "@/game/ui/createContributionList";

interface GithubEventData {
  username: string;
  pushCount: number;
  pullRequestCount: number;
}

interface GithubStateData {
  progress: number;
  contributions: Record<string, number>;
}

// 프로그레스 증가량 설정
const PROGRESS_PER_COMMIT = 2; // 커밋당 2%
const PROGRESS_PER_PR = 5; // PR당 5%

export class MapScene extends Phaser.Scene {
  private minZoom: number = 0.7;
  private maxZoom: number = 2;
  private player?: Player;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private tileSize: number = 32;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private gridVisible: boolean = true;
  private gridKey?: Phaser.Input.Keyboard.Key;
  private xKey?: Phaser.Input.Keyboard.Key; // 테스트용 키

  // Remote Players
  private otherPlayers: Map<string, RemotePlayer> = new Map();
  private username: string = "";

  // Room ID
  private roomId: string = "";

  // Progress Bar
  private progressBarController?: ProgressBarController;

  // Contribution List
  private contributionController?: ContributionController;

  // Map Management
  private currentMapIndex: number = 0;
  private maps = [
    { image: "tiles1", tilemap: "tilemap1" },
    { image: "tiles2", tilemap: "tilemap2" },
  ];

  constructor() {
    super({ key: "MogakcoScene" });
  }

  preload() {
    // 맵 이미지와 Tiled JSON 로드
    // 외부 이미지(깃허브)를 로드하려면 CORS 권한이 필요
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
    this.load.image("face", `/api/github-profile/${username}`);
  }

  init() {
    const user = this.registry.get("user");
    this.username = user?.username;
  }

  create() {
    // 1. Map & Grid Setup
    this.setupMap();

    // 2. Anims Setup
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
    this.setupCamera();

    // 8. Socket Setup
    this.setupSocket();

    // 9. Grid Setup
    this.drawGrid();

    this.setupChat();
  }

  createAnimations() {
    const FRAME_RATE = 10;

    // 아래쪽 방향
    if (!this.anims.exists("walk-down")) {
      this.anims.create({
        key: "walk-down",
        frames: this.anims.generateFrameNumbers("body", { start: 0, end: 3 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }

    // 왼쪽 방향
    if (!this.anims.exists("walk-left")) {
      this.anims.create({
        key: "walk-left",
        frames: this.anims.generateFrameNumbers("body", { start: 4, end: 7 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }

    // 오른쪽 방향
    if (!this.anims.exists("walk-right")) {
      this.anims.create({
        key: "walk-right",
        frames: this.anims.generateFrameNumbers("body", { start: 8, end: 11 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }

    // 위쪽 방향
    if (!this.anims.exists("walk-up")) {
      this.anims.create({
        key: "walk-up",
        frames: this.anims.generateFrameNumbers("body", { start: 12, end: 15 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }
  }

  setupMap() {
    // 현재 맵 인덱스에 따른 맵 로드
    const currentMap = this.maps[this.currentMapIndex];

    // 맵 이미지 배치
    const mapImage = this.add.image(0, 0, currentMap.image);
    mapImage.setOrigin(0, 0);
    mapImage.setName("mapImage");
    mapImage.setDepth(-1); // 맵 zIndex를 가장 낮게

    // 맵 크기에 맞게 월드 경계 설정 (Physics World Bounds)
    this.physics.world.setBounds(0, 0, mapImage.width, mapImage.height);

    // Tiled 맵 로드
    const map = this.make.tilemap({ key: currentMap.tilemap });

    // Physics Wall Group 생성
    this.walls = this.physics.add.staticGroup();

    // Tiled JSON에서 충돌 영역 로드
    const collisionLayer = map.getObjectLayer("Collisions");
    if (collisionLayer) {
      collisionLayer.objects.forEach((obj) => {
        const isWall =
          ("class" in obj && obj.class === "wall") || obj.type === "wall";

        if (isWall && obj.x !== undefined && obj.y !== undefined) {
          // 보이지 않는 오브젝트 설정 (충돌 감지용)
          const wall = this.add.rectangle(
            obj.x + (obj.width || 0) / 2,
            obj.y + (obj.height || 0) / 2,
            obj.width,
            obj.height,
            0xff0000,
            0,
          );
          // 보이지 않는 벽으로 설정
          wall.setVisible(false);
          this.walls?.add(wall);
        }
      });
    }
  }

  setupPlayer() {
    const mapImage = this.children.getByName(
      "mapImage",
    ) as Phaser.GameObjects.Image;
    const mapWidth = mapImage.width;
    const mapHeight = mapImage.height;

    // 시작 위치 (중앙)
    const startX =
      Math.floor(mapWidth / 2 / this.tileSize) * this.tileSize +
      this.tileSize / 2;
    const startY =
      Math.floor(mapHeight / 2 / this.tileSize) * this.tileSize +
      this.tileSize / 2;

    const socket = getSocket();
    const myId = socket?.id || `guest-${Math.floor(Math.random() * 1000)}`;
    const GITHUB_USERNAME = this.username;

    // Player 인스턴스 생성 (roomId는 나중에 서버로부터 받아서 설정)
    this.player = new Player(
      this,
      startX,
      startY,
      GITHUB_USERNAME,
      myId,
      this.roomId || "pending",
    );
  }

  setupControls() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.gridKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.G,
      );
      // 테스트용 X 키 (게이지 100% 채우기)
      this.xKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    }

    // 마우스 휠로 확대/축소
    this.input.on("wheel", this.handleZoom, this);
  }

  setupUI() {
    const mapImage = this.children.getByName(
      "mapImage",
    ) as Phaser.GameObjects.Image;
    const mapWidth = mapImage.width;

    // 기존 UI 제거 (맵 전환 시 중복 방지)
    if (this.progressBarController) {
      this.progressBarController.destroy();
    }
    if (this.contributionController) {
      this.contributionController.destroy();
    }

    // 프로그레스바 생성
    this.progressBarController = createProgressBar(this, mapWidth);

    // 게이지 100% 도달 시 맵 전환 콜백 등록
    this.progressBarController.onProgressComplete = () => {
      this.switchToNextMap();
    };

    // 기여도 리스트 생성 (프로그레스바 아래)
    this.contributionController = createContributionList(this, mapWidth, 50);
  }

  setupCollisions() {
    // 플레이어 충돌 설정
    if (this.walls && this.player) {
      this.physics.add.collider(this.player.getContainer(), this.walls);
    }

    // 리모트 플레이어들 충돌 설정
    this.otherPlayers.forEach((remotePlayer) => {
      if (this.walls) {
        this.physics.add.collider(remotePlayer.getContainer(), this.walls);
      }
    });
  }

  setupCamera() {
    const mapImage = this.children.getByName(
      "mapImage",
    ) as Phaser.GameObjects.Image;
    if (mapImage) {
      this.cameras.main.setBounds(0, 0, mapImage.width, mapImage.height);
      this.cameras.main.centerOn(mapImage.width / 2, mapImage.height / 2);
      if (this.player) {
        this.cameras.main.startFollow(
          this.player.getContainer(),
          true,
          0.05,
          0.05,
        );
      }
      this.setInitialZoom(mapImage.width, mapImage.height);
    }
  }

  setupChat() {
    const existingInput = document.getElementById("chat-input");
    if (existingInput) {
      existingInput.remove();
    }

    // 2. HTML Input 생성
    const input = document.createElement("input");
    input.id = "chat-input";
    input.type = "text";
    input.className =
      "absolute bottom-[100px] left-1/2 -translate-x-1/2 w-[300px] p-[10px] rounded-[20px] border-[2px] border-[#333] bg-white hidden z-[1000] placeholder:text-gray-500 font-sans";
    input.placeholder = "메시지를 입력하세요 (Enter로 전송)";

    document.body.appendChild(input);

    // 3. Enter 키 이벤트 (Phaser Input) - 채팅창 열기
    this.input.keyboard?.on("keydown-ENTER", () => {
      // 이미 포커스된 상태면 무시
      if (document.activeElement === input) return;

      input.style.display = "block";
      input.focus();
      this.input.keyboard!.enabled = false;
    });

    // 4. Input 내 Enter 키 이벤트 - 채팅 전송
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();

      if (e.key === "Enter") {
        if (input.value.trim() !== "") {
          this.sendChat(input.value);
        }
        this.closeChatInput(input);
      } else if (e.key === "Escape") {
        this.closeChatInput(input);
      }
    });

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.remove();
    });
  }

  closeChatInput(input: HTMLInputElement) {
    input.value = "";
    input.style.display = "none";
    input.blur();
    this.input.keyboard!.enabled = true; // 게임 키 다시 활성화
  }

  sendChat(message: string) {
    if (!this.player) return;

    // 1. 내 캐릭터에 말풍선 표시
    this.player.showChatBubble(message);

    // 2. 소켓 전송
    const socket = getSocket();
    if (socket) {
      socket.emit("chatting", { message });
    }
  }

  setupSocket() {
    const socket = connectSocket();
    if (!socket) return;

    const GITHUB_USERNAME = this.username;

    // 소켓 연결 시 내 플레이어 ID 업데이트 (Ghost Player 방지)
    socket.on("connect", () => {
      if (this.player && socket.id) {
        this.player.id = socket.id;
      }

      // Join Event (재연결 시에도 다시 join 필요할 수 있음)
      socket.emit("joining", {
        x: this.player?.getContainer().x,
        y: this.player?.getContainer().y,
        username: GITHUB_USERNAME,
      });
    });

    // 서버로부터 배정된 roomId 수신
    socket.on("joined", (data: { roomId: string }) => {
      this.roomId = data.roomId;
      if (this.player) {
        this.player.setRoomId(data.roomId);
      }
    });

    // 다른 탭에서 접속하여 현재 세션이 종료됨
    socket.on("session_replaced", () => {
      socket.disconnect();
      this.showSessionEndedOverlay();
    });

    // 1. 기존 유저 싱크
    socket.on("players_synced", (players: PlayerData[]) => {
      players.forEach((data) => {
        this.addRemotePlayer(data);
      });
    });

    // 2. 새 유저 입장
    socket.on("player_joined", (data: PlayerData) => {
      this.addRemotePlayer(data);
    });

    // 3. 유저 이동
    socket.on("moved", (data: PlayerData) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (
        remotePlayer &&
        data.isMoving !== undefined &&
        data.direction !== undefined
      ) {
        remotePlayer.updateState({
          x: data.x,
          y: data.y,
          isMoving: data.isMoving,
          direction: data.direction,
        });
      }
    });

    // 4. 유저 퇴장
    socket.on("player_left", (data: { userId: string }) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (remotePlayer) {
        remotePlayer.destroy();
        this.otherPlayers.delete(data.userId);
      }
    });

    // 6. GitHub 초기 상태 수신 (새로고침 시 복원용)
    socket.on("github_state", (data: GithubStateData) => {
      this.progressBarController?.setProgress(data.progress);
      this.contributionController?.setContributions(data.contributions);
    });

    // 7. GitHub 이벤트 수신 → 프로그레스바 & 기여도 업데이트
    socket.on("github_event", (data: GithubEventData) => {
      const progressIncrement =
        data.pushCount * PROGRESS_PER_COMMIT +
        data.pullRequestCount * PROGRESS_PER_PR;

      if (progressIncrement > 0) {
        // 프로그레스바 업데이트
        this.progressBarController?.addProgress(progressIncrement);

        // 기여도 업데이트 (커밋 + PR 합산)
        const totalCount = data.pushCount + data.pullRequestCount;
        this.contributionController?.addContribution(data.username, totalCount);
      }
    });

    // 8. 채팅 메시지 수신
    socket.on("chatted", (data: { userId: string; message: string }) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (remotePlayer) {
        remotePlayer.showChatBubble(data.message);
      }
    });
  }

  addRemotePlayer(data: PlayerData) {
    if (this.otherPlayers.has(data.userId)) return;
    // 내 아이디면 스킵
    if (this.player && this.player.id === data.userId) return;

    const username = data.username || "unknown";
    const remotePlayer = new RemotePlayer(
      this,
      data.x,
      data.y,
      username,
      data.userId,
      username,
    );
    this.otherPlayers.set(data.userId, remotePlayer);

    // 충돌 설정 (새 플레이어 추가 시에만)
    if (this.walls) {
      this.physics.add.collider(remotePlayer.getContainer(), this.walls);
    }

    if (!this.textures.exists(username)) {
      const imageUrl = `/api/github-profile/${username}`;

      this.load.image(username, imageUrl);
      this.load.once(`filecomplete-image-${username}`, () => {
        remotePlayer.updateFaceTexture(username);
      });
      this.load.start();
    }
  }

  setInitialZoom(mapWidth: number, mapHeight: number) {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const zoomX = screenWidth / mapWidth;
    const zoomY = screenHeight / mapHeight;
    const initialZoom = Math.max(zoomX, zoomY);
    this.cameras.main.setZoom(initialZoom);
  }

  handleZoom(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ) {
    const currentZoom = this.cameras.main.zoom;
    const zoomDelta = deltaY > 0 ? -0.2 : 0.2;
    const newZoom = currentZoom + zoomDelta;

    // 줌 레벨 제한
    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    this.cameras.main.setZoom(clampedZoom);
  }

  drawGrid() {
    const existingGraphics = this.children.getByName("grid");
    if (existingGraphics) existingGraphics.destroy();

    const mapImage = this.children.getByName(
      "mapImage",
    ) as Phaser.GameObjects.Image;
    if (!mapImage) return;

    const width = mapImage.width;
    const height = mapImage.height;
    const cols = Math.ceil(width / this.tileSize);
    const rows = Math.ceil(height / this.tileSize);

    const graphics = this.add.graphics();
    graphics.setName("grid");
    graphics.lineStyle(1, 0x00ff00, 0.3);

    for (let x = 0; x <= cols; x++) {
      graphics.moveTo(x * this.tileSize, 0);
      graphics.lineTo(x * this.tileSize, height);
    }
    for (let y = 0; y <= rows; y++) {
      graphics.moveTo(0, y * this.tileSize);
      graphics.lineTo(width, y * this.tileSize);
    }
    graphics.strokePath();
    graphics.setVisible(this.gridVisible);
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    const grid = this.children.getByName("grid") as Phaser.GameObjects.Graphics;
    if (grid) grid.setVisible(this.gridVisible);
  }

  showSessionEndedOverlay() {
    // 게임 일시정지
    this.scene.pause();

    // 반투명 배경
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

    // 메시지 텍스트
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
      this.toggleGrid();
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
    if (this.player) {
      this.player.updateFocusTime(focusTime);
    }

    // Player Update
    this.player.update(this.cursors);

    // Remote Players Update
    this.otherPlayers.forEach((p) => p.update());
  }

  switchToNextMap() {
    // 다음 맵 인덱스 계산(현재는 임시로 다음 인덱스)
    this.currentMapIndex = (this.currentMapIndex + 1) % this.maps.length;

    // 페이드아웃 효과
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once("camerafadeoutcomplete", () => {
      // 기존 맵 제거
      const oldMapImage = this.children.getByName("mapImage");
      if (oldMapImage) {
        oldMapImage.destroy();
      }

      // 기존 벽 제거
      this.walls?.clear(true, true);

      // 기존 그리드 제거
      const oldGrid = this.children.getByName("grid");
      if (oldGrid) {
        oldGrid.destroy();
      }

      // 새 맵 로드
      this.setupMap();

      // 충돌 재설정
      this.setupCollisions();

      // UI 재설정 (프로그레스바, 기여도 리스트)
      this.setupUI();

      // 카메라 재설정
      this.setupCamera();

      // 그리드 재설정
      this.drawGrid();

      // 페이드인
      this.cameras.main.fadeIn(500, 0, 0, 0);
    });
  }
}
