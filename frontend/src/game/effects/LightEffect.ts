import * as Phaser from "phaser";
import { Candle } from "./lights/Candle";

export interface LightData {
  class: string;
  x: number;
  y: number;
}

interface Light {
  destroy(): void;
}

interface LightConstructor {
  new (scene: Phaser.Scene, context: LightData): Light;
}

const registry: Record<string, LightConstructor> = {
  candle: Candle,
};

/**
 * Tilemap 의 Lights 레이어에서 Light 객체를 생성하는 팩토리
 * Tilemap class 이름 기반으로 생성 타입 결정
 */
export default class LightEffect {
  private scene: Phaser.Scene;
  private worldScale: number;
  private lights: Light[] = [];

  constructor(scene: Phaser.Scene, worldScale: number) {
    this.scene = scene;
    this.worldScale = worldScale;

    scene.events.on("map_setup", this.create, this);
    scene.events.once("shutdown", this.destroy, this);
  }

  create(tilemapKey: string): void {
    this.destroy();
    const objects = this.parseLightObjects(tilemapKey);
    objects.forEach((context) => {
      const LightClass = registry[context.class];
      if (!LightClass) return;
      const light = new LightClass(this.scene, context);
      this.lights.push(light);
    });
  }

  destroy(): void {
    this.lights.forEach((l) => l.destroy());
    this.lights = [];
  }

  private parseLightObjects(tilemapKey: string): LightData[] {
    const cache = this.scene.cache.tilemap.get(tilemapKey);
    if (!cache) return [];

    const mapData = cache.data as {
      layers?: {
        name: string;
        type: string;
        objects?: Record<string, unknown>[];
      }[];
    };

    const lightsLayer = mapData.layers?.find(
      (l) => l.name === "Lights" && l.type === "objectgroup",
    );
    if (!lightsLayer?.objects) return [];

    return lightsLayer.objects
      .filter((obj) => obj["x"] !== undefined && obj["y"] !== undefined)
      .map((obj) => ({
        class: (obj["class"] ?? obj["type"] ?? "") as string,
        x: (obj["x"] as number) / this.worldScale,
        y: (obj["y"] as number) / this.worldScale,
      }))
      .filter(({ class: name }) => name in registry);
  }
}
