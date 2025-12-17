import * as Phaser from "phaser";
import Player from "../players/Player";
import RemotePlayer from "../players/RemotePlayer";
import { connectSocket, getSocket } from "../../lib/socket";

interface PlayerData {
  userId: string;
  username?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  direction?: string;
  timestamp?: number;
}
import { createProgressBar } from "@/game/ui/createProgressBar";

export class MapScene extends Phaser.Scene {
  private minZoom: number = 0.7;
  private maxZoom: number = 2;
  private player?: Player;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private tileSize: number = 32;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private gridVisible: boolean = true;
  private gridKey?: Phaser.Input.Keyboard.Key;

  // Remote Players
  private otherPlayers: Map<string, RemotePlayer> = new Map();

  constructor() {
    super({ key: "MogakcoScene" });
  }

  preload() {
    // 맵 이미지와 Tiled JSON 로드
    // 외부 이미지(깃허브)를 로드하려면 CORS 권한이 필요
    this.load.crossOrigin = "anonymous";
    this.load.image("tiles", "/assets/tempMap1.png");
    this.load.tilemapTiledJSON("tilemap", "/assets/map.json");

    // Default Face
    this.load.image("face", `/github-image/heisjun.png`);
  }

  create() {
    // 1. Map & Grid Setup
    this.setupMap();

    // 2. Player Setup
    this.setupPlayer();

    // 3. Controls Setup
    this.setupControls();

    // 4. Camera Setup
    this.setupCamera();

    // 5. Socket Logic Setup
    this.setupSocket();

    // 6. Draw Grid (Visual)
    this.drawGrid();
  }

  setupMap() {
    // 맵 이미지 배치
    const mapImage = this.add.image(0, 0, "tiles");
    mapImage.setOrigin(0, 0);
    mapImage.setName("mapImage");

    // 맵 크기에 맞게 월드 경계 설정 (Physics World Bounds)
    this.physics.world.setBounds(0, 0, mapImage.width, mapImage.height);

    // Tiled 맵 로드
    const map = this.make.tilemap({ key: "tilemap" });

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
    const GITHUB_USERNAME = "heisjun"; // [TODO] 실제 로그인 정보 연동

    // Player 인스턴스 생성
    this.player = new Player(
      this,
      startX,
      startY,
      GITHUB_USERNAME,
      myId,
      "room-1",
    );

    // 충돌 설정
    if (this.walls && this.player) {
      this.physics.add.collider(this.player.getContainer(), this.walls);
    }
  }

  setupControls() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.gridKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.G,
      );
    }

    // 마우스 휠 줌
    this.input.on("wheel", this.handleZoom, this);
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

  setupSocket() {
    const socket = connectSocket("http://localhost:8080");
    if (!socket) return;

    const GITHUB_USERNAME = "heisjun"; // [TODO]

    // Join Event
    socket.emit("joining", {
      x: this.player?.getContainer().x,
      y: this.player?.getContainer().y,
      username: GITHUB_USERNAME,
      roomId: "room-1",
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

    // 이미지 로드 (필요시)
    if (!this.textures.exists(username)) {
      const imageUrl = username.startsWith("heisjun")
        ? `/github-image/boostcampwm2025.png`
        : `/github-image/${username}.png`;

      this.load.image(username, imageUrl);
      this.load.once(`filecomplete-image-${username}`, () => {
        remotePlayer.updateFaceTexture(username);
      });
      this.load.start();
    }
    // 프로그레스바 생성
    createProgressBar(this, mapWidth);

    // 마우스 휠로 확대/축소
    this.input.on("wheel", this.handleZoom, this);
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

  update() {
    if (!this.player || !this.cursors) return;

    // Grid Toggle
    if (this.gridKey && Phaser.Input.Keyboard.JustDown(this.gridKey)) {
      this.toggleGrid();
    }

    // Player Update
    this.player.update(this.cursors);

    // Remote Players Update
    this.otherPlayers.forEach((p) => p.update());
  }
}
