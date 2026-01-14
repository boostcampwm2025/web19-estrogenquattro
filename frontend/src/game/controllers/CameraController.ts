import * as Phaser from "phaser";

export default class CameraController {
  private scene: Phaser.Scene;
  private minZoom: number = 0.7;
  private maxZoom: number = 2;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setup(
    mapWidth: number,
    mapHeight: number,
    target?: Phaser.GameObjects.Container,
  ): void {
    this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.scene.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);

    if (target) {
      this.scene.cameras.main.startFollow(target, true, 0.05, 0.05);
    }

    this.setInitialZoom(mapWidth, mapHeight);

    this.scene.input.on("wheel", this.handleZoom, this);
  }

  private setInitialZoom(mapWidth: number, mapHeight: number): void {
    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    const zoomX = screenWidth / mapWidth;
    const zoomY = screenHeight / mapHeight;
    // 맵 전체가 보이도록 작은 값 사용
    const initialZoom = Math.min(zoomX, zoomY);
    this.scene.cameras.main.setZoom(initialZoom);
  }

  private handleZoom(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const currentZoom = this.scene.cameras.main.zoom;
    const zoomDelta = deltaY > 0 ? -0.2 : 0.2;
    const newZoom = currentZoom + zoomDelta;

    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    this.scene.cameras.main.setZoom(clampedZoom);
  }

  updateBounds(mapWidth: number, mapHeight: number): void {
    this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.setInitialZoom(mapWidth, mapHeight);
  }
}
