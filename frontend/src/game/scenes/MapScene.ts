import * as Phaser from "phaser";

export class MapScene extends Phaser.Scene {
  private minZoom: number = 0.7;
  private maxZoom: number = 2;
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private tileSize: number = 32;
  private isMoving: boolean = false;
  private walls: Phaser.GameObjects.Rectangle[] = [];
  private gridVisible: boolean = true;
  private gridKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "MogakcoScene" });
  }

  preload() {
    // 맵 이미지와 Tiled JSON 로드
    this.load.image("tiles", "/assets/tempMap1.png");
    this.load.tilemapTiledJSON("tilemap", "/assets/map.json");
  }

  create() {
    // 맵 좌상단에 맞춰서 표시
    const mapImage = this.add.image(0, 0, "tiles");
    mapImage.setOrigin(0, 0);
    mapImage.setName("mapImage");

    // 맵 크기
    const mapWidth = mapImage.width;
    const mapHeight = mapImage.height;

    // Tiled 맵 로드
    const map = this.make.tilemap({ key: "tilemap" });

    // Tiled JSON에서 충돌 영역 로드
    const collisionLayer = map.getObjectLayer("Collisions");

    if (collisionLayer) {
      collisionLayer.objects.forEach((obj) => {
        // class="wall" 또는 type="wall"인 오브젝트만 처리
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
          wall.setVisible(false);

          // 배열에 추가
          this.physics.add.existing(wall, true);
          this.walls.push(wall);
        }
      });
    }

    // 임시 플레이어 생성 (그리드 중앙)
    const startX =
      Math.floor(mapWidth / 2 / this.tileSize) * this.tileSize +
      this.tileSize / 2;
    const startY =
      Math.floor(mapHeight / 2 / this.tileSize) * this.tileSize +
      this.tileSize / 2;

    this.player = this.physics.add.sprite(startX, startY, "");

    // 플레이어를 파란색 원으로 표시 (임시)
    const playerGraphics = this.add.graphics();
    playerGraphics.fillStyle(0x0000ff, 1);
    playerGraphics.fillCircle(0, 0, 16);
    playerGraphics.generateTexture("player", 32, 32);
    playerGraphics.destroy();
    this.player.setTexture("player");

    // 키보드 입력 설정
    this.cursors = this.input.keyboard?.createCursorKeys();

    // 그리드 토글 키 설정 (G 키)
    this.gridKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.G,
    );

    // 카메라 범위를 맵 크기로 제한
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // 카메라를 맵 중앙으로 이동
    this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);

    // 초기 줌 레벨 설정 (공백 최소화)
    this.setInitialZoom(mapWidth, mapHeight);

    this.drawGrid();

    // 테스트용 텍스트 (맵 중앙에 배치)
    const middleText = this.add
      .text(mapWidth / 2, mapHeight / 2, "Map Scene", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    middleText.setName("mapText");

    // 마우스 휠로 확대/축소
    this.input.on("wheel", this.handleZoom, this);
  }

  setInitialZoom(mapWidth: number, mapHeight: number) {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    // 화면을 꽉 채우는 줌 레벨 계산 (공백 최소화)
    const zoomX = screenWidth / mapWidth;
    const zoomY = screenHeight / mapHeight;
    const initialZoom = Math.max(zoomX, zoomY);

    // 초기 줌 적용
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
    // 기존 그리드 제거
    const existingGraphics = this.children.getByName("grid");
    if (existingGraphics) {
      existingGraphics.destroy();
    }

    const mapImage = this.children.getByName(
      "mapImage",
    ) as Phaser.GameObjects.Image;
    if (!mapImage) return;

    // 맵 전체 크기에 맞춰 그리드 그리기
    const width = mapImage.width;
    const height = mapImage.height;
    const tileSize = 32;

    // 그리드 계산
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);

    // 그리드 그리기
    const graphics = this.add.graphics();
    graphics.setName("grid");
    graphics.lineStyle(1, 0x00ff00, 0.3);

    // 세로 선
    for (let x = 0; x <= cols; x++) {
      graphics.moveTo(x * tileSize, 0);
      graphics.lineTo(x * tileSize, height);
    }

    // 가로 선
    for (let y = 0; y <= rows; y++) {
      graphics.moveTo(0, y * tileSize);
      graphics.lineTo(width, y * tileSize);
    }

    graphics.strokePath();
  }

  update() {
    if (!this.player || !this.cursors) return;

    // G 키로 그리드 토글
    if (this.gridKey && Phaser.Input.Keyboard.JustDown(this.gridKey)) {
      this.toggleGrid();
    }

    // 이동 중이면 입력 무시
    if (this.isMoving) return;

    let targetX = this.player.x;
    let targetY = this.player.y;

    // 방향키 입력 체크
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      targetX -= this.tileSize;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      targetX += this.tileSize;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      targetY -= this.tileSize;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      targetY += this.tileSize;
    }

    // 이동할 위치가 변경되었는지 확인
    if (targetX !== this.player.x || targetY !== this.player.y) {
      // 충돌 체크
      if (this.canMoveTo(targetX, targetY)) {
        this.moveToTile(targetX, targetY);
      }
    }
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;

    const grid = this.children.getByName("grid");
    if (grid instanceof Phaser.GameObjects.Graphics) {
      grid.setVisible(this.gridVisible);
    }
  }

  canMoveTo(x: number, y: number): boolean {
    // 각 벽과 충돌 체크
    for (const wall of this.walls) {
      const wallBody = wall.body as Phaser.Physics.Arcade.StaticBody;
      if (!wallBody) continue;

      // 플레이어의 바운딩 박스 (16px 반지름)
      const playerLeft = x - 16;
      const playerRight = x + 16;
      const playerTop = y - 16;
      const playerBottom = y + 16;

      // 벽의 바운딩 박스
      const wallLeft = wallBody.x;
      const wallRight = wallBody.x + wallBody.width;
      const wallTop = wallBody.y;
      const wallBottom = wallBody.y + wallBody.height;

      // AABB 충돌 체크
      if (
        playerLeft < wallRight &&
        playerRight > wallLeft &&
        playerTop < wallBottom &&
        playerBottom > wallTop
      ) {
        return false; // 충돌 발생
      }
    }

    return true; // 이동 가능
  }

  moveToTile(targetX: number, targetY: number) {
    if (!this.player) return;

    this.isMoving = true;

    // Tween을 사용한 부드러운 이동
    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: 150, // 이동 시간 (ms)
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
      },
    });
  }
}
