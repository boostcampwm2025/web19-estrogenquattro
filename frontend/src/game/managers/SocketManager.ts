import * as Phaser from "phaser";
import RemotePlayer from "../players/RemotePlayer";
import { connectSocket, getSocket } from "../../lib/socket";
import type {
  ProgressBarController,
  ContributionController,
} from "../scenes/MapScene";
import type { Direction } from "../types/direction";

interface PlayerData {
  userId: string;
  username?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  direction?: Direction;
  timestamp?: number;
  // FocusTime 관련 필드 (players_synced에서 수신)
  status?: "FOCUSING" | "RESTING";
  lastFocusStartTime?: string | null;
  totalFocusMinutes?: number;
}

interface GithubEventData {
  username: string;
  pushCount: number;
  pullRequestCount: number;
}

interface GithubStateData {
  progress: number;
  contributions: Record<string, number>;
}

// 프로그레스 증가량 설정
const PROGRESS_PER_COMMIT = 2;
const PROGRESS_PER_PR = 5;

export default class SocketManager {
  private scene: Phaser.Scene;
  private otherPlayers: Map<string, RemotePlayer> = new Map();
  private roomId: string = "";
  private username: string;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private progressBarController?: ProgressBarController;
  private contributionController?: ContributionController;
  private getPlayer: () =>
    | {
        id: string;
        getContainer: () => Phaser.GameObjects.Container;
        setRoomId: (roomId: string) => void;
        showChatBubble: (message: string) => void;
      }
    | undefined;

  constructor(
    scene: Phaser.Scene,
    username: string,
    getPlayer: () =>
      | {
          id: string;
          getContainer: () => Phaser.GameObjects.Container;
          setRoomId: (roomId: string) => void;
          showChatBubble: (message: string) => void;
        }
      | undefined,
  ) {
    this.scene = scene;
    this.username = username;
    this.getPlayer = getPlayer;
  }

  setWalls(walls: Phaser.Physics.Arcade.StaticGroup) {
    this.walls = walls;
  }

  setProgressBarController(controller: ProgressBarController) {
    this.progressBarController = controller;
  }

  setContributionController(controller: ContributionController) {
    this.contributionController = controller;
  }

  getRoomId(): string {
    return this.roomId;
  }

  connect(showSessionEndedOverlay: () => void): void {
    const socket = connectSocket();
    if (!socket) return;

    const player = this.getPlayer();

    socket.on("connect", () => {
      if (player && socket.id) {
        player.id = socket.id;
      }

      socket.emit("joining", {
        x: player?.getContainer().x,
        y: player?.getContainer().y,
        username: this.username,
      });
    });

    socket.on("joined", (data: { roomId: string }) => {
      this.roomId = data.roomId;
      const currentPlayer = this.getPlayer();
      if (currentPlayer) {
        currentPlayer.setRoomId(data.roomId);
      }
    });

    socket.on("session_replaced", () => {
      socket.disconnect();
      showSessionEndedOverlay();
    });

    socket.on("players_synced", (players: PlayerData[]) => {
      console.log("[DEBUG SocketManager] received 'players_synced':", players);
      players.forEach((data) => {
        this.addRemotePlayer(data);
      });
    });

    socket.on("player_joined", (data: PlayerData) => {
      this.addRemotePlayer(data);
    });

    socket.on("moved", (data: PlayerData) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (
        remotePlayer &&
        data.isMoving !== undefined &&
        data.direction !== undefined
      ) {
        remotePlayer.updateState({
          x: data.x,
          y: data.y,
          isMoving: data.isMoving,
          direction: data.direction,
        });
      }
    });

    socket.on("player_left", (data: { userId: string }) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (remotePlayer) {
        remotePlayer.destroy();
        this.otherPlayers.delete(data.userId);
      }
    });

    socket.on("github_state", (data: GithubStateData) => {
      this.progressBarController?.setProgress(data.progress);
      this.contributionController?.setContributions(data.contributions);
    });

    socket.on("github_event", (data: GithubEventData) => {
      const progressIncrement =
        data.pushCount * PROGRESS_PER_COMMIT +
        data.pullRequestCount * PROGRESS_PER_PR;

      if (progressIncrement > 0) {
        this.progressBarController?.addProgress(progressIncrement);
        const totalCount = data.pushCount + data.pullRequestCount;
        this.contributionController?.addContribution(data.username, totalCount);
      }
    });

    socket.on("chatted", (data: { userId: string; message: string }) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (remotePlayer) {
        remotePlayer.showChatBubble(data.message);
      }
    });

    // 다른 플레이어 집중 시작
    socket.on(
      "focused",
      (data: {
        userId: string;
        status: string;
        taskName?: string;
        lastFocusStartTime?: string;
        totalFocusMinutes?: number;
      }) => {
        console.log("[DEBUG SocketManager] received 'focused' event:", data);
        if (data.status !== "FOCUSING") return;
        const remotePlayer = this.otherPlayers.get(data.userId);
        console.log("[DEBUG SocketManager] remotePlayer found:", !!remotePlayer);
        if (remotePlayer) {
          console.log("[DEBUG SocketManager] calling setFocusState with taskName:", data.taskName);
          remotePlayer.setFocusState(true, {
            taskName: data.taskName,
            lastFocusStartTime: data.lastFocusStartTime,
            totalFocusMinutes: data.totalFocusMinutes ?? 0,
          });
        }
      },
    );

    // 다른 플레이어 휴식 시작
    socket.on(
      "rested",
      (data: { userId: string; status: string; totalFocusMinutes?: number }) => {
        if (data.status !== "RESTING") return;
        const remotePlayer = this.otherPlayers.get(data.userId);
        if (remotePlayer) {
          remotePlayer.setFocusState(false, {
            totalFocusMinutes: data.totalFocusMinutes ?? 0,
          });
        }
      },
    );
  }

  private addRemotePlayer(data: PlayerData): void {
    if (this.otherPlayers.has(data.userId)) return;

    const player = this.getPlayer();
    if (player && player.id === data.userId) return;

    const username = data.username || "unknown";
    const remotePlayer = new RemotePlayer(
      this.scene,
      data.x,
      data.y,
      username,
      data.userId,
      username,
    );
    this.otherPlayers.set(data.userId, remotePlayer);

    // 입장 시 기존 플레이어의 집중 상태 반영 (FOCUSING/RESTING 모두 태그 표시)
    console.log("[DEBUG SocketManager] addRemotePlayer - setting focus state:", {
      userId: data.userId,
      status: data.status,
      isFocusing: data.status === "FOCUSING",
    });
    remotePlayer.setFocusState(data.status === "FOCUSING", {
      lastFocusStartTime: data.lastFocusStartTime ?? undefined,
      totalFocusMinutes: data.totalFocusMinutes ?? 0,
    });

    if (this.walls) {
      this.scene.physics.add.collider(remotePlayer.getContainer(), this.walls);
    }

    if (!this.scene.textures.exists(username)) {
      const imageUrl = `https://avatars.githubusercontent.com/${username}`;

      this.scene.load.image(username, imageUrl);
      this.scene.load.once(`filecomplete-image-${username}`, () => {
        remotePlayer.updateFaceTexture(username);
      });
      this.scene.load.start();
    }
  }

  setupCollisions(): void {
    this.otherPlayers.forEach((remotePlayer) => {
      if (this.walls) {
        this.scene.physics.add.collider(
          remotePlayer.getContainer(),
          this.walls,
        );
      }
    });
  }

  getRemotePlayers(): Map<string, RemotePlayer> {
    return this.otherPlayers;
  }

  updateRemotePlayers(): void {
    this.otherPlayers.forEach((p) => p.update());
  }

  sendChat(message: string): void {
    const player = this.getPlayer();
    if (!player) return;

    player.showChatBubble(message);

    const socket = getSocket();
    if (socket) {
      socket.emit("chatting", { message });
    }
  }

  destroy(): void {
    this.otherPlayers.forEach((player) => player.destroy());
    this.otherPlayers.clear();
  }
}
