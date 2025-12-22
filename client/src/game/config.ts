import * as Phaser from "phaser";

// Placeholder - will be replaced in Phase 1.3
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  scene: {
    create: function () {
      this.add.text(400, 300, "Game Loading...", {
        fontSize: "24px",
        color: "#ffffff",
      }).setOrigin(0.5);
    },
  },
};
