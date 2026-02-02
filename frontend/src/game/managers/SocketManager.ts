import * as Phaser from "phaser";
import RemotePlayer from "../players/RemotePlayer";
import { connectSocket, getSocket } from "../../lib/socket";
import { useProgressStore } from "../../stores/useProgressStore";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useContributionStore } from "../../stores/useContributionStore";
import type { Direction } from "../types/direction";
import { FOCUS_STATUS, FocusStatus } from "@/stores/useFocusTimeStore";
import {
  useFocusTimeStore,
  type FocusTimeData,
} from "../../stores/useFocusTimeStore";
import { getTodayStartTime } from "@/utils/timeFormat";

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

// progress_update 이벤트 페이로드 (S→C)
interface ProgressUpdateData {
  username: string;
  source: string;
  targetProgress: number;
  contributions: Record<string, number>;
  mapIndex: number;
}

// game_state 이벤트 페이로드 (S→C, 입장 시)
interface GameStateData {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;
}

export default class SocketManager {
  private scene: Phaser.Scene;
  private otherPlayers: Map<string, RemotePlayer> = new Map();
  private roomId: string = "";
  private username: string;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private isSessionReplaced: boolean = false;
  private isInitialized: boolean = false;
  private currentMapIndex: number = 0;
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

  getRoomId(): string {
    return this.roomId;
  }

  /**
   * Player 생성 후 joining 이벤트 emit
   * 첫 연결 시: initializeWithMap() → setupPlayer() 후 호출
   * 재연결 시: connect 이벤트 핸들러에서 호출
   */
  emitJoining(): void {
    const socket = getSocket();
    const player = this.getPlayer();
    if (!socket || !player) return;

    socket.emit("joining", {
      x: player.getContainer().x,
      y: player.getContainer().y,
      username: this.username,
      startAt: getTodayStartTime(),
    });
  }

  connect(callbacks: {
    showSessionEndedOverlay: () => void;
    onMapSwitch: (mapIndex: number) => void;
    onMapSyncRequired: (mapIndex: number) => void;
    onInitialMapLoad: (mapIndex: number) => void;
  }): void {
    const socket = connectSocket();
    if (!socket) return;

    socket.on("connect", () => {
      // 재연결 시 오버레이 숨김 및 플래그 리셋
      useConnectionStore.getState().setDisconnected(false);
      this.isSessionReplaced = false;

      const player = this.getPlayer();
      if (player && socket.id) {
        player.id = socket.id;
      }

      // 재연결 시에만 joining emit (Player가 이미 존재하는 경우)
      // 첫 연결 시에는 Player 생성 후 emitJoining() 호출
      if (player) {
        this.emitJoining();
      }
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
      useConnectionStore.getState().setDisconnected(true);
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

    // 입장 시 초기 상태 수신
    socket.on("game_state", (data: GameStateData) => {
      useProgressStore.getState().setProgress(data.progress);
      useProgressStore.getState().setMapIndex(data.mapIndex);
      useContributionStore.getState().setContributions(data.contributions);

      // 첫 접속: 맵 로드 후 Player, UI 등 초기화
      if (!this.isInitialized) {
        this.isInitialized = true;
        this.currentMapIndex = data.mapIndex;
        callbacks.onInitialMapLoad(data.mapIndex);
        return;
      }

      // 재접속: 맵 동기화
      const needsMapSync = data.mapIndex !== this.currentMapIndex;
      if (needsMapSync) {
        callbacks.onMapSyncRequired(data.mapIndex);
        this.currentMapIndex = data.mapIndex;
      }
    });

    // 실시간 progress 업데이트 (절대값 동기화)
    socket.on("progress_update", (data: ProgressUpdateData) => {
      useProgressStore.getState().setProgress(data.targetProgress);
      useProgressStore.getState().setMapIndex(data.mapIndex);
      useContributionStore.getState().setContributions(data.contributions);

      // mapIndex 동기화: map_switch 유실 시 복구
      const needsMapSync = data.mapIndex !== this.currentMapIndex;
      if (needsMapSync) {
        callbacks.onMapSyncRequired(data.mapIndex);
        this.currentMapIndex = data.mapIndex;
      }
    });

    // 정상 맵 전환 (progress 100% 도달)
    socket.on("map_switch", (data: { mapIndex: number }) => {
      if (data.mapIndex === this.currentMapIndex) return;
      this.currentMapIndex = data.mapIndex;
      callbacks.onMapSwitch(data.mapIndex);
    });

    // 시즌 리셋 (매주 월요일 00:00 KST)
    socket.on("season_reset", (data: { mapIndex: number }) => {
      useProgressStore.getState().setProgress(0);
      useContributionStore.getState().reset();
      this.currentMapIndex = data.mapIndex;
      callbacks.onMapSyncRequired(data.mapIndex);
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

  /**
   * 리스폰 위치를 서버에 전송 (moving 이벤트 래퍼)
   * - 맵 전환 후 플레이어 위치 동기화에 사용
   * - 기존 moving 이벤트 인프라 재사용
   */
  sendRespawnPosition(x: number, y: number): void {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("moving", {
      x,
      y,
      isMoving: false,
      direction: "down",
      timestamp: Date.now(),
    });
  }

  destroy(): void {
    this.otherPlayers.forEach((player) => player.destroy());
    this.otherPlayers.clear();
  }
}
