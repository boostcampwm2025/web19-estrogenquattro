import * as Phaser from "phaser";
import RemotePlayer from "../players/RemotePlayer";
import { connectSocket, getSocket } from "../../lib/socket";
import type { ContributionController } from "../scenes/MapScene";
import { useProgressStore } from "../../stores/useProgressStore";
import type { Direction } from "../types/direction";
import { FOCUS_STATUS, FocusStatus } from "@/stores/useFocusTimeStore";
import {
  useFocusTimeStore,
  type FocusTimeData,
} from "../../stores/useFocusTimeStore";

interface PlayerData {
  userId: string;
  username?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  direction?: Direction;
  timestamp?: number;
  playerId?: number;
  petImage?: string | null; // 펫 이미지 URL 추가
  // FocusTime 관련 필드 (players_synced에서 수신)
  status?: FocusStatus;
  lastFocusStartTime?: string | null;
  totalFocusSeconds?: number;
  currentSessionSeconds?: number;
  taskName?: string | null; // 현재 집중 중인 태스크 이름
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
  private contributionController?: ContributionController;
  private isSessionReplaced: boolean = false;
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

  setContributionController(controller: ContributionController) {
    this.contributionController = controller;
  }

  getRoomId(): string {
    return this.roomId;
  }

  connect(callbacks: {
    showSessionEndedOverlay: () => void;
    showConnectionLostOverlay: () => void;
    hideConnectionLostOverlay: () => void;
  }): void {
    const socket = connectSocket();
    if (!socket) return;

    const player = this.getPlayer();

    socket.on("connect", () => {
      // 재연결 시 오버레이 숨김 및 플래그 리셋
      callbacks.hideConnectionLostOverlay();
      this.isSessionReplaced = false;

      if (player && socket.id) {
        player.id = socket.id;
      }

      socket.emit("joining", {
        x: player?.getContainer().x,
        y: player?.getContainer().y,
        username: this.username,
      });
    });

    // JWT 만료 시 로그인 페이지로 이동 (서버에서 주기적 검증으로 감지)
    socket.on("auth_expired", () => {
      window.location.href = "/login";
    });

    // 연결 끊김 시 JWT 만료 vs 서버 다운 구분
    socket.on("disconnect", async (reason) => {
      // 세션 교체된 경우 제외
      if (this.isSessionReplaced) return;
      // 클라이언트가 의도적으로 끊은 경우 제외
      if (reason === "io client disconnect") return;

      // JWT 유효성 확인 (frozen 상태에서 auth_expired 못 받았을 때 백업)
      try {
        const res = await fetch("/auth/me", { credentials: "include" });
        if (res.status === 401) {
          // JWT 만료 → 로그인 페이지
          window.location.href = "/login";
          return;
        }
      } catch {
        // 네트워크 에러 (서버 다운) - 연결 끊김 UI 표시로 진행
      }

      // 서버 문제 → 연결 끊김 UI
      callbacks.showConnectionLostOverlay();
    });

    socket.on(
      "joined",
      (data: { roomId: string; focusTime?: FocusTimeData }) => {
        this.roomId = data.roomId;
        const currentPlayer = this.getPlayer();
        if (currentPlayer) {
          currentPlayer.setRoomId(data.roomId);
        }
        // 서버에서 받은 focusTime 정보로 로컬 상태 복원
        if (data.focusTime) {
          useFocusTimeStore.getState().syncFromServer(data.focusTime);
        }
      },
    );

    socket.on("session_replaced", () => {
      this.isSessionReplaced = true;
      socket.disconnect();
      callbacks.showSessionEndedOverlay();
    });

    socket.on("players_synced", (players: PlayerData[]) => {
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
      useProgressStore.getState().setProgress(data.progress);
      this.contributionController?.setContributions(data.contributions);
    });

    socket.on("github_event", (data: GithubEventData) => {
      const progressIncrement =
        data.pushCount * PROGRESS_PER_COMMIT +
        data.pullRequestCount * PROGRESS_PER_PR;

      if (progressIncrement > 0) {
        useProgressStore.getState().addProgress(progressIncrement);
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
        totalFocusSeconds?: number;
        currentSessionSeconds?: number;
      }) => {
        if (data.status !== FOCUS_STATUS.FOCUSING) return;
        const remotePlayer = this.otherPlayers.get(data.userId);
        if (remotePlayer) {
          remotePlayer.setFocusState(true, {
            taskName: data.taskName,
            totalFocusSeconds: data.totalFocusSeconds ?? 0,
            currentSessionSeconds: data.currentSessionSeconds ?? 0,
          });
        }
      },
    );

    // 다른 플레이어 휴식 시작
    socket.on(
      "rested",
      (data: {
        userId: string;
        status: string;
        totalFocusSeconds?: number;
      }) => {
        if (data.status !== FOCUS_STATUS.RESTING) return;
        const remotePlayer = this.otherPlayers.get(data.userId);
        if (remotePlayer) {
          remotePlayer.setFocusState(false, {
            totalFocusSeconds: data.totalFocusSeconds ?? 0,
          });
        }
      },
    );

    // 다른 플레이어 집중 Task 이름 변경
    socket.on(
      "focus_task_updated",
      (data: { userId: string; username: string; taskName: string }) => {
        const remotePlayer = this.otherPlayers.get(data.userId);
        if (remotePlayer) {
          remotePlayer.updateTaskBubble({
            isFocusing: true,
            taskName: data.taskName,
          });
        }
      },
    );

    // 다른 플레이어 펫 교체
    socket.on("pet_equipped", (data: { userId: string; petImage: string }) => {
      const remotePlayer = this.otherPlayers.get(data.userId);
      if (remotePlayer) {
        remotePlayer.setPet(data.petImage);
      }
    });
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
      data.playerId ?? 0,
    );
    this.otherPlayers.set(data.userId, remotePlayer);

    // 입장 시 기존 플레이어의 집중 상태 반영 (FOCUSING/RESTING 모두 태그 표시)
    remotePlayer.setFocusState(data.status === FOCUS_STATUS.FOCUSING, {
      totalFocusSeconds: data.totalFocusSeconds ?? 0,
      currentSessionSeconds: data.currentSessionSeconds ?? 0,
      taskName: data.taskName ?? undefined,
    });

    // 펫 정보가 있으면 설정
    if (data.petImage) {
      remotePlayer.setPet(data.petImage);
    }

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
    this.otherPlayers.forEach((p) => {
      p.update();
      p.updateFocusDisplay(); // 타임스탬프 기반 시간 업데이트
    });
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
