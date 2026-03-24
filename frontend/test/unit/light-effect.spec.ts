import { beforeEach, describe, expect, it, vi } from "vitest";

const { candleInstances, CandleMock } = vi.hoisted(() => {
  const instances: Array<{
    destroy: ReturnType<typeof vi.fn>;
    scene: unknown;
    context: unknown;
  }> = [];

  const ctor = vi.fn().mockImplementation((scene, context) => {
    const instance = {
      destroy: vi.fn(),
      scene,
      context,
    };
    instances.push(instance);
    return instance;
  });

  return {
    candleInstances: instances,
    CandleMock: ctor,
  };
});

vi.mock("phaser", () => ({}));

vi.mock("@/game/effects/lights/Candle", () => ({
  Candle: CandleMock,
}));

import LightEffect from "@/game/effects/LightEffect";

describe("LightEffect", () => {
  beforeEach(() => {
    CandleMock.mockClear();
    candleInstances.length = 0;
  });

  it("Lights 레이어의 candle type/class만 worldScale 기준 좌표로 생성한다", () => {
    const scene = {
      events: {
        on: vi.fn(),
        once: vi.fn(),
      },
      cache: {
        tilemap: {
          get: vi.fn(() => ({
            data: {
              layers: [
                {
                  name: "Lights",
                  type: "objectgroup",
                  objects: [
                    { type: "candle", x: 664, y: 2194 },
                    { class: "candle", x: 2231.33333333333, y: 2555.33333333333 },
                    { type: "torch", x: 1, y: 2 },
                    { type: "candle", x: 10 },
                  ],
                },
              ],
            },
          })),
        },
      },
    };

    const lightEffect = new LightEffect(scene as never, 4);

    lightEffect.create("tilemap1");

    expect(CandleMock).toHaveBeenCalledTimes(2);
    expect(CandleMock).toHaveBeenNthCalledWith(1, scene, {
      class: "candle",
      x: 166,
      y: 548.5,
    });
    expect(CandleMock).toHaveBeenNthCalledWith(2, scene, {
      class: "candle",
      x: 557.8333333333325,
      y: 638.8333333333325,
    });
  });

  it("Lights 레이어가 없으면 light를 생성하지 않는다", () => {
    const scene = {
      events: {
        on: vi.fn(),
        once: vi.fn(),
      },
      cache: {
        tilemap: {
          get: vi.fn(() => ({
            data: {
              layers: [{ name: "Collisions", type: "objectgroup", objects: [] }],
            },
          })),
        },
      },
    };

    const lightEffect = new LightEffect(scene as never, 4);
    lightEffect.create("tilemap1");

    expect(CandleMock).not.toHaveBeenCalled();
  });

  it("create를 다시 호출하면 기존 light를 먼저 destroy한 뒤 새로 생성한다", () => {
    const cache = {
      tilemap: {
        get: vi
          .fn()
          .mockReturnValueOnce({
            data: {
              layers: [
                {
                  name: "Lights",
                  type: "objectgroup",
                  objects: [{ type: "candle", x: 400, y: 800 }],
                },
              ],
            },
          })
          .mockReturnValueOnce({
            data: {
              layers: [
                {
                  name: "Lights",
                  type: "objectgroup",
                  objects: [{ type: "candle", x: 800, y: 1200 }],
                },
              ],
            },
          }),
      },
    };

    const scene = {
      events: {
        on: vi.fn(),
        once: vi.fn(),
      },
      cache,
    };

    const lightEffect = new LightEffect(scene as never, 4);

    lightEffect.create("tilemap1");
    const firstInstance = candleInstances[0];

    lightEffect.create("tilemap1");

    expect(firstInstance.destroy).toHaveBeenCalledTimes(1);
    expect(CandleMock).toHaveBeenCalledTimes(2);
    expect(CandleMock).toHaveBeenNthCalledWith(2, scene, {
      class: "candle",
      x: 200,
      y: 300,
    });
  });
});
