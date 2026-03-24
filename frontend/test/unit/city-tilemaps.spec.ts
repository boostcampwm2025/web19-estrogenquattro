import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type TilemapLayer = {
  id: number;
  name: string;
  type: string;
  objects?: Array<{
    id: number;
    type?: string;
    class?: string;
    x?: number;
    y?: number;
  }>;
};

type TilemapData = {
  layers: TilemapLayer[];
};

const expectedCollisionObjectCounts = {
  1: 285,
  2: 521,
  3: 518,
  4: 532,
  5: 454,
} as const;

function loadCityStage(stage: keyof typeof expectedCollisionObjectCounts): TilemapData {
  const filePath = path.resolve(
    process.cwd(),
    "public/assets/tilemaps/city",
    `city_stage${stage}.json`,
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as TilemapData;
}

describe("city tilemap fixture", () => {
  it("city stage1~5 모두 Lights object layer와 candle 포인트 2개를 가진다", () => {
    for (const stage of [1, 2, 3, 4, 5] as const) {
      const tilemap = loadCityStage(stage);
      const lightsLayer = tilemap.layers.find(
        (layer) => layer.name === "Lights" && layer.type === "objectgroup",
      );

      expect(lightsLayer, `stage${stage} Lights layer`).toBeDefined();

      const candleObjects =
        lightsLayer?.objects?.filter(
          (object) => (object.class ?? object.type) === "candle",
        ) ?? [];

      expect(candleObjects, `stage${stage} candle objects`).toHaveLength(2);
      candleObjects.forEach((object) => {
        expect(object.x).toEqual(expect.any(Number));
        expect(object.y).toEqual(expect.any(Number));
      });
    }
  });

  it("city stage1~5의 Collisions 레이어 구조는 유지된다", () => {
    for (const stage of [1, 2, 3, 4, 5] as const) {
      const tilemap = loadCityStage(stage);
      const collisionsLayer = tilemap.layers.find(
        (layer) => layer.name === "Collisions" && layer.type === "objectgroup",
      );

      expect(collisionsLayer, `stage${stage} Collisions layer`).toBeDefined();
      expect(collisionsLayer?.objects).toHaveLength(
        expectedCollisionObjectCounts[stage],
      );
    }
  });
});
