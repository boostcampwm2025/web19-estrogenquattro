import * as Phaser from "phaser";

export default class CameraController {
  private scene: Phaser.Scene;
  private minZoom: number = 0.7;
  private maxZoom: number = 2;
  private mapWidth: number = 0;
  private mapHeight: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setup(
    mapWidth: number,
    mapHeight: number,
    target?: Phaser.GameObjects.Container,
  ): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.scene.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);

    if (target) {
      this.scene.cameras.main.startFollow(target, true, 0.05, 0.05);
    }

    this.setInitialZoom(mapWidth, mapHeight);

    this.scene.input.on("wheel", this.handleZoom, this);
    this.scene.scale.on("resize", this.handleResize, this);
  }

  private setInitialZoom(mapWidth: number, mapHeight: number): void {
    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    const zoomX = screenWidth / mapWidth;
    const zoomY = screenHeight / mapHeight;
    // 맵 전체가 보이도록 작은 값 사용, 이 값을 minZoom으로 설정
    const initialZoom = Math.min(zoomX, zoomY);
    this.minZoom = initialZoom;
    this.scene.cameras.main.setZoom(initialZoom);

    // 맵을 화면 가운데에 배치하기 위한 오프셋 계산
    const scaledMapWidth = mapWidth * initialZoom;
    const scaledMapHeight = mapHeight * initialZoom;
    const offsetX = (screenWidth - scaledMapWidth) / 2 / initialZoom;
    const offsetY = (screenHeight - scaledMapHeight) / 2 / initialZoom;

    // 카메라 bounds를 조정하여 상하좌우 여백이 동일하게
    this.scene.cameras.main.setBounds(
      -offsetX,
      -offsetY,
      mapWidth + offsetX * 2,
      mapHeight + offsetY * 2,
    );
    this.scene.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);
  }

  private handleResize(): void {
    if (this.mapWidth > 0 && this.mapHeight > 0) {
      this.setInitialZoom(this.mapWidth, this.mapHeight);
    }
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
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.setInitialZoom(mapWidth, mapHeight);
  }

  destroy(): void {
    this.scene.input.off("wheel", this.handleZoom, this);
    this.scene.scale.off("resize", this.handleResize, this);
  }
}
