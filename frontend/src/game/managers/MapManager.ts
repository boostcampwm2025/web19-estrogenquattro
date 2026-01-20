import * as Phaser from "phaser";

export interface MapConfig {
  image: string;
  tilemap: string;
  imagePath: string;
  tilemapPath: string;
}

export default class MapManager {
  private scene: Phaser.Scene;
  private maps: MapConfig[];
  private currentMapIndex: number = 0;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private tileSize: number = 32;

  // 월드 스케일: 이미지는 2배 크기, 좌표는 원본 크기 기준
  private worldScale: number = 2;

  constructor(scene: Phaser.Scene, maps: MapConfig[]) {
    this.scene = scene;
    this.maps = maps;
  }

  setup(): void {
    const currentMap = this.maps[this.currentMapIndex];

    const mapImage = this.scene.add.image(0, 0, currentMap.image);
    mapImage.setOrigin(0, 0);
    mapImage.setName("mapImage");
    mapImage.setDepth(-1);

    // 월드 좌표는 이미지 크기 / 스케일 (원본 크기 기준)
    const worldWidth = mapImage.width / this.worldScale;
    const worldHeight = mapImage.height / this.worldScale;

    // 이미지를 월드 좌표에 맞게 스케일 다운 (시각적으로는 원본 크기로 보임)
    mapImage.setScale(1 / this.worldScale);

    this.scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.walls = this.scene.physics.add.staticGroup();

    // tilemap이 있는 경우에만 충돌 처리
    if (currentMap.tilemap) {
      const map = this.scene.make.tilemap({ key: currentMap.tilemap });

      const collisionLayer = map.getObjectLayer("Collisions");
      if (collisionLayer) {
        collisionLayer.objects.forEach((obj) => {
          const isWall =
            ("class" in obj && obj.class === "wall") || obj.type === "wall";

          if (isWall && obj.x !== undefined && obj.y !== undefined) {
            // Tiled 좌표도 스케일 적용
            const wall = this.scene.add.rectangle(
              (obj.x + (obj.width || 0) / 2) / this.worldScale,
              (obj.y + (obj.height || 0) / 2) / this.worldScale,
              (obj.width || 0) / this.worldScale,
              (obj.height || 0) / this.worldScale,
              0xff0000,
              0,
            );
            wall.setVisible(false);
            this.walls?.add(wall);
          }
        });
      }
    }
  }

  getMapImage(): Phaser.GameObjects.Image | null {
    return this.scene.children.getByName(
      "mapImage",
    ) as Phaser.GameObjects.Image | null;
  }

  getWalls(): Phaser.Physics.Arcade.StaticGroup | undefined {
    return this.walls;
  }

  getMapSize(): { width: number; height: number } {
    const mapImage = this.getMapImage();
    if (mapImage) {
      // 월드 좌표 기준으로 반환 (원본 크기)
      return {
        width: mapImage.width / this.worldScale,
        height: mapImage.height / this.worldScale,
      };
    }
    return { width: 0, height: 0 };
  }

  getWorldScale(): number {
    return this.worldScale;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  switchToNextMap(onMapReady: () => void): void {
    this.currentMapIndex = (this.currentMapIndex + 1) % this.maps.length;

    this.scene.cameras.main.fadeOut(500, 0, 0, 0);

    this.scene.cameras.main.once("camerafadeoutcomplete", () => {
      const oldMapImage = this.scene.children.getByName("mapImage");
      if (oldMapImage) {
        oldMapImage.destroy();
      }

      this.walls?.clear(true, true);

      this.setup();

      onMapReady();

      this.scene.cameras.main.fadeIn(500, 0, 0, 0);
    });
  }

  getCurrentMapIndex(): number {
    return this.currentMapIndex;
  }

  destroy(): void {
    this.walls?.clear(true, true);
    const mapImage = this.getMapImage();
    if (mapImage) mapImage.destroy();
  }
}
