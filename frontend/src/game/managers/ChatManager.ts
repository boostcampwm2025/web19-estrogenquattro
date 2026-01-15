import * as Phaser from "phaser";

export default class ChatManager {
  private scene: Phaser.Scene;
  private input: HTMLInputElement | null = null;
  private sendMessage: (message: string) => void;

  constructor(scene: Phaser.Scene, sendMessage: (message: string) => void) {
    this.scene = scene;
    this.sendMessage = sendMessage;
  }

  setup(): void {
    const existingInput = document.getElementById("chat-input");
    if (existingInput) {
      existingInput.remove();
    }

    const input = document.createElement("input");
    input.id = "chat-input";
    input.type = "text";
    input.className =
      "absolute bottom-[100px] left-1/2 -translate-x-1/2 w-[300px] p-[10px] rounded-[20px] border-[2px] border-[#333] bg-white hidden z-[1000] placeholder:text-gray-500 font-sans";
    input.placeholder = "메시지를 입력하세요 (Enter로 전송)";

    document.body.appendChild(input);
    this.input = input;

    this.scene.input.keyboard?.on("keydown-ENTER", () => {
      if (document.activeElement === input) return;

      input.style.display = "block";
      input.focus();
      this.scene.input.keyboard!.enabled = false;
    });

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();

      if (e.key === "Enter") {
        if (input.value.trim() !== "") {
          this.sendMessage(input.value);
        }
        this.closeInput();
      } else if (e.key === "Escape") {
        this.closeInput();
      }
    });

    this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroy();
    });
  }

  private closeInput(): void {
    if (!this.input) return;

    this.input.value = "";
    this.input.style.display = "none";
    this.input.blur();
    this.scene.input.keyboard!.enabled = true;
  }

  destroy(): void {
    if (this.input) {
      this.input.remove();
      this.input = null;
    }
  }
}
