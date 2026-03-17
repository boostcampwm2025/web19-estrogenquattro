import * as Phaser from "phaser";
import type { LightData } from "../LightEffect";

const EMBER_KEY = "candle_ember";
const GLOW_KEY = "candle_glow";
const GLOW_SIZE = 256;
const GLOW_SCALE = 320 / 256;
const DEPTH = 5;

export class Candle {
  private glow: Phaser.GameObjects.Image;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private pulseTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, data: LightData) {
    this.glow = this.createGlow(scene, data);
    this.emitter = this.createEmber(scene, data);
    this.pulseTween = this.createPulseTween(scene);
  }

  private createGlow(
    scene: Phaser.Scene,
    data: LightData,
  ): Phaser.GameObjects.Image {
    const { x, y } = data;

    if (!scene.textures.exists(GLOW_KEY)) {
      const SIZE = GLOW_SIZE;
      const CENTER = SIZE / 2;
      const canvas = scene.textures.createCanvas(GLOW_KEY, SIZE, SIZE);

      if (canvas) {
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(
          CENTER,
          CENTER,
          0,
          CENTER,
          CENTER,
          CENTER,
        );

        gradient.addColorStop(0, "rgba(255, 140,  30, 0.35)");
        gradient.addColorStop(0.3, "rgba(255, 180,  70, 0.25)");
        gradient.addColorStop(0.6, "rgba(255, 238, 204, 0.12)");
        gradient.addColorStop(0.85, "rgba(255, 255, 238, 0.03)");
        gradient.addColorStop(1, "rgba(255, 255, 238, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, SIZE, SIZE);
        canvas.refresh();
      }
    }

    const sprite = scene.add.image(x, y, GLOW_KEY);
    sprite.setScale(GLOW_SCALE);
    sprite.setBlendMode(Phaser.BlendModes.ADD);
    sprite.setAlpha(0.1);
    sprite.setDepth(DEPTH);

    return sprite;
  }

  private createEmber(
    scene: Phaser.Scene,
    data: LightData,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const { x, y } = data;

    if (!scene.textures.exists(EMBER_KEY)) {
      const SIZE = 12;
      const CENTER = SIZE / 2;
      const canvas = scene.textures.createCanvas(EMBER_KEY, SIZE, SIZE);

      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = "rgba(255, 150, 40, 1.0)";
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, CENTER, 0, Math.PI * 2);
        ctx.fill();
        canvas.refresh();
      }
    }

    const emitter = scene.add.particles(x, y, EMBER_KEY, {
      x: { min: -2, max: 2 },
      y: { min: -8, max: 0 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.7, end: 0 },
      speed: { min: 2, max: 8 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 1500, max: 2800 },
      frequency: 250,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    emitter.setDepth(DEPTH + 1);

    return emitter;
  }

  private createPulseTween(scene: Phaser.Scene): Phaser.Tweens.Tween {
    const tween = scene.tweens.add({
      targets: this.glow,
      alpha: 0.4,
      duration: 2000 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    return tween;
  }

  destroy(): void {
    this.glow.destroy();
    this.emitter.destroy();
    this.pulseTween.remove();
  }
}
