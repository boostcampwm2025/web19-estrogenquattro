import * as Phaser from "phaser";
import RemotePlayer from "../players/RemotePlayer";
import { connectSocket, getSocket } from "../../lib/socket";
import { useProgressStore } from "../../stores/useProgressStore";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useContributionStore } from "../../stores/useContributionStore";
import { useTasksStore } from "../../stores/useTasksStore";
import type { Direction } from "../types/direction";
import { FOCUS_STATUS, FocusStatus } from "@/stores/useFocusTimeStore";
import {
  useFocusTimeStore,
  type FocusTimeData,
} from "../../stores/useFocusTimeStore";
import { getTodayStartTime } from "@/utils/timeFormat";
import { useRoomStore } from "../../stores/useRoomStore";
import { MODAL_TYPES, useModalStore } from "../../stores/useModalStore";

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
  isListening?: boolean; // 음악 감상 중 여부
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
  progressThreshold: number;
}

// game_state 이벤트 페이로드 (S→C, 입장 시)
interface GameStateData {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;
  progressThreshold: number;
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
  private mapSwitchTimeout: ReturnType<typeof setTimeout> | null = null;

  // 아바타 로더 리스너 추적 (비동기 로드 중 destroy 버그 수정)
  private avatarLoaderListeners: Map<
    string,
    Array<{
      errorListener: (file: Phaser.Loader.File) => void;
      completeListener: () => void;
      textureKey: string;
    }>
  > = new Map();
  private avatarLoadingKeys: Set<string> = new Set();

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

  private clearMapSwitchTimeout(): void {
    if (this.mapSwitchTimeout) {
      clearTimeout(this.mapSwitchTimeout);
      this.mapSwitchTimeout = null;
    }
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

    const pendingRoomId = useRoomStore.getState().pendingRoomId;

    const payload: {
      x: number;
      y: number;
      username: string;
      startAt: string;
      roomId?: string;
    } = {
      x: player.getContainer().x,
      y: player.getContainer().y,
      username: this.username,
      startAt: getTodayStartTime(),
    };

    if (pendingRoomId) {
      payload.roomId = pendingRoomId;
      useRoomStore.getState().setPendingRoomId(null);
    }

    socket.emit("joining", payload);
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

      // 방 이동/재연결 시 기존 플레이어 제거 (Ghosting 방지 및 순서 보장)
      this.otherPlayers.forEach((player) => player.destroy());
      this.otherPlayers.clear();

      const player = this.getPlayer();
      if (player && socket.id) {
        player.id = socket.id;
      }

      // 재연결 시에만 joining emit (Player가 이미 존재하는 경우)
      // 첫 연결 시에는 Player 생성 후 emitJoining() 호출
      if (player) {
        // 미디어(음악) 리셋 이벤트 발생 -> MusicPlayer가 이를 수신하여 정지함
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("reset_media"));
        }

        // 로컬 Task 상태 정지 (UI 상의 Running 상태 제거)
        useTasksStore.getState().stopAllTasks();

        // 트랜지션 완료 이벤트 발생 (MapScene에서 Iris Open 수행)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("channel_transition_complete"));
        }

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
        useRoomStore.getState().setRoomId(data.roomId);
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
      this.clearMapSwitchTimeout();
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
        this.cleanupAllAvatarListeners(data.userId);
        remotePlayer.destroy();
        this.otherPlayers.delete(data.userId);
      }
    });

    // 입장 실패 처리 (방 없음, 방 꽉 짐 등)
    socket.on("join_failed", (data: { message: string; code: string }) => {
      console.warn("[SocketManager] join_failed:", data);
      if (data.code === "ROOM_NOT_FOUND") {
        alert("유효하지 않은 방입니다. 다시 로그인해주세요.");
        window.location.href = "/login";
      } else if (data.code === "ROOM_FULL") {
        alert("방이 꽉 찼습니다. 다른 채널을 선택해주세요.");
        // 채널 선택 모달 다시 열기
        useModalStore.getState().openModal(MODAL_TYPES.CHANNEL_SELECT);
      }
    });

    // 입장 시 초기 상태 수신
    socket.on("game_state", (data: GameStateData) => {
      useProgressStore.getState().setProgress(data.progress);
      useProgressStore.getState().setMapIndex(data.mapIndex);
      useProgressStore.getState().setProgressThreshold(data.progressThreshold);
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
      useProgressStore.getState().setProgressThreshold(data.progressThreshold);
      useContributionStore.getState().setContributions(data.contributions);

      // mapIndex 동기화: map_switch 유실 시 복구
      const needsMapSync = data.mapIndex !== this.currentMapIndex;
      if (needsMapSync) {
        callbacks.onMapSyncRequired(data.mapIndex);
        this.currentMapIndex = data.mapIndex;
      }
    });

    // 정상 맵 전환 (progress 100% 도달)
    // 1초 디바운스로 빠른 연속 이벤트 중 마지막만 처리
    socket.on("map_switch", (data: { mapIndex: number }) => {
      if (this.mapSwitchTimeout) {
        clearTimeout(this.mapSwitchTimeout);
      }

      this.mapSwitchTimeout = setTimeout(() => {
        if (data.mapIndex === this.currentMapIndex) return;
        this.currentMapIndex = data.mapIndex;
        callbacks.onMapSwitch(data.mapIndex);
      }, 1000);
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

    // 다른 플레이어 음악 상태 변경
    socket.on(
      "player_music_status",
      (data: { userId: string; isListening: boolean }) => {
        const remotePlayer = this.otherPlayers.get(data.userId);
        if (remotePlayer) {
          remotePlayer.setMusicStatus(data.isListening);
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

    // 음악 상태가 있으면 설정
    if (data.isListening !== undefined) {
      remotePlayer.setMusicStatus(data.isListening);
    }

    if (this.walls) {
      this.scene.physics.add.collider(remotePlayer.getContainer(), this.walls);
    }

    this.loadAvatar(data, remotePlayer);
  }

  private loadAvatar(data: PlayerData, remotePlayer: RemotePlayer): void {
    const targetUserId = data.userId;
    const username = data.username || "unknown";
    const textureKey = `avatar_${targetUserId}`;

    // 이미 텍스처가 있으면 바로 적용
    if (this.scene.textures.exists(textureKey)) {
      remotePlayer.updateFaceTexture(textureKey);
      return;
    }

    const loader = this.scene.load;

    // 이미 로드 중인지 확인 (자체 추적)
    const isAlreadyLoading = this.avatarLoadingKeys.has(textureKey);

    const cleanup = () => {
      this.avatarLoadingKeys.delete(textureKey);
      this.removeAvatarListener(
        targetUserId,
        errorListener,
        completeListener,
        textureKey,
      );
    };

    const errorListener = (file: Phaser.Loader.File) => {
      if (file.key === textureKey) {
        console.error(
          `[SocketManager] Avatar load error for ${textureKey}:`,
          file,
        );
        cleanup();
      }
    };

    const completeListener = () => {
      cleanup();
      const player = this.otherPlayers.get(targetUserId);
      if (player) {
        player.updateFaceTexture(textureKey);
      }
    };

    // 리스너 등록 (배열에 추가)
    this.addAvatarListener(targetUserId, {
      errorListener,
      completeListener,
      textureKey,
    });

    loader.on("loaderror", errorListener);
    loader.once(`filecomplete-image-${textureKey}`, completeListener);

    // 이미 로드 중이 아닐 때만 새 로드 시작
    if (!isAlreadyLoading) {
      this.avatarLoadingKeys.add(textureKey);
      const imageUrl = `https://avatars.githubusercontent.com/${username}`;
      loader.image(textureKey, imageUrl);

      if (!loader.isLoading()) {
        loader.start();
      }
    }
  }

  private addAvatarListener(
    userId: string,
    listener: {
      errorListener: (file: Phaser.Loader.File) => void;
      completeListener: () => void;
      textureKey: string;
    },
  ): void {
    const existing = this.avatarLoaderListeners.get(userId) || [];
    existing.push(listener);
    this.avatarLoaderListeners.set(userId, existing);
  }

  private removeAvatarListener(
    userId: string,
    errorListener: (file: Phaser.Loader.File) => void,
    completeListener: () => void,
    textureKey: string,
  ): void {
    const listeners = this.avatarLoaderListeners.get(userId);
    if (!listeners) return;

    if (this.scene?.load) {
      this.scene.load.off("loaderror", errorListener);
      this.scene.load.off(`filecomplete-image-${textureKey}`, completeListener);
    }

    const filtered = listeners.filter(
      (l) =>
        l.errorListener !== errorListener &&
        l.completeListener !== completeListener,
    );

    if (filtered.length > 0) {
      this.avatarLoaderListeners.set(userId, filtered);
    } else {
      this.avatarLoaderListeners.delete(userId);
    }
  }

  private cleanupAllAvatarListeners(userId: string): void {
    const listeners = this.avatarLoaderListeners.get(userId);
    if (!listeners || !this.scene?.load) return;

    listeners.forEach(({ errorListener, completeListener, textureKey }) => {
      this.scene.load.off("loaderror", errorListener);
      this.scene.load.off(`filecomplete-image-${textureKey}`, completeListener);
      this.avatarLoadingKeys.delete(textureKey);
    });

    this.avatarLoaderListeners.delete(userId);
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
    this.clearMapSwitchTimeout();

    // 모든 아바타 로더 리스너 정리
    this.avatarLoaderListeners.forEach((_, userId) => {
      this.cleanupAllAvatarListeners(userId);
    });
    this.avatarLoadingKeys.clear();

    this.otherPlayers.forEach((player) => player.destroy());
    this.otherPlayers.clear();
  }
}
