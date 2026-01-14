import * as Phaser from "phaser";

export interface MapConfig {
  image: string;
  tilemap: string;
}

export default class MapManager {
  private scene: Phaser.Scene;
  private maps: MapConfig[];
  private currentMapIndex: number = 0;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private tileSize: number = 32;
  private gridVisible: boolean = true;

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

    this.scene.physics.world.setBounds(0, 0, mapImage.width, mapImage.height);

    const map = this.scene.make.tilemap({ key: currentMap.tilemap });

    this.walls = this.scene.physics.add.staticGroup();

    const collisionLayer = map.getObjectLayer("Collisions");
    if (collisionLayer) {
      collisionLayer.objects.forEach((obj) => {
        const isWall =
          ("class" in obj && obj.class === "wall") || obj.type === "wall";

        if (isWall && obj.x !== undefined && obj.y !== undefined) {
          const wall = this.scene.add.rectangle(
            obj.x + (obj.width || 0) / 2,
            obj.y + (obj.height || 0) / 2,
            obj.width,
            obj.height,
            0xff0000,
            0,
          );
          wall.setVisible(false);
          this.walls?.add(wall);
        }
      });
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
      return { width: mapImage.width, height: mapImage.height };
    }
    return { width: 0, height: 0 };
  }

  getTileSize(): number {
    return this.tileSize;
  }

  drawGrid(): void {
    const existingGraphics = this.scene.children.getByName("grid");
    if (existingGraphics) existingGraphics.destroy();

    const mapImage = this.getMapImage();
    if (!mapImage) return;

    const width = mapImage.width;
    const height = mapImage.height;
    const cols = Math.ceil(width / this.tileSize);
    const rows = Math.ceil(height / this.tileSize);

    const graphics = this.scene.add.graphics();
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

  toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    const grid = this.scene.children.getByName(
      "grid",
    ) as Phaser.GameObjects.Graphics;
    if (grid) grid.setVisible(this.gridVisible);
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

      const oldGrid = this.scene.children.getByName("grid");
      if (oldGrid) {
        oldGrid.destroy();
      }

      this.setup();

      onMapReady();

      this.drawGrid();

      this.scene.cameras.main.fadeIn(500, 0, 0, 0);
    });
  }

  getCurrentMapIndex(): number {
    return this.currentMapIndex;
  }

  destroy(): void {
    this.walls?.clear(true, true);
    const grid = this.scene.children.getByName("grid");
    if (grid) grid.destroy();
    const mapImage = this.getMapImage();
    if (mapImage) mapImage.destroy();
  }
}
