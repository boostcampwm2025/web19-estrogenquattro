/**
 * 버그 제보 시 자동 수집되는 진단 정보
 *
 * - 환경 정보 (OS, 브라우저, 화면, 언어)
 * - 앱 상태 스냅샷 (room, connection, focus, modal)
 * - 소켓 연결 상태
 * - 최근 콘솔 에러/경고 로그
 */

import { getSocket } from "@/lib/socket";
import { getRecentLogs } from "@/lib/logBuffer";
import { useRoomStore } from "@/stores/useRoomStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useFocusTimeStore } from "@/stores/useFocusTimeStore";
import { useModalStore } from "@/stores/useModalStore";

export interface DiagnosticData {
  environment: {
    userAgent: string;
    language: string;
    platform: string;
    screenResolution: string;
    viewportSize: string;
    timestamp: string;
    url: string;
  };
  appState: {
    room: {
      roomId: string;
      pendingRoomId: string | null;
    };
    connection: {
      isDisconnected: boolean;
      socketConnected: boolean;
    };
    focus: {
      status: string;
      isFocusTimerRunning: boolean;
      focusTimeSeconds: number;
    };
    activeModal: string | null;
  };
  recentLogs: {
    level: string;
    message: string;
    timestamp: string;
  }[];
}

/**
 * 현재 환경 정보 + 앱 상태 + 로그를 수집하여 반환
 */
export function collectDiagnostics(): DiagnosticData {
  // 환경 정보
  const environment = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    url: `${window.location.origin}${window.location.pathname}`,
  };

  // 앱 상태 스냅샷 (Zustand getState()로 리액트 외부에서 접근)
  const roomState = useRoomStore.getState();
  const connectionState = useConnectionStore.getState();
  const focusState = useFocusTimeStore.getState();
  const modalState = useModalStore.getState();

  const socket = getSocket();

  const appState = {
    room: {
      roomId: roomState.roomId,
      pendingRoomId: roomState.pendingRoomId,
    },
    connection: {
      isDisconnected: connectionState.isDisconnected,
      socketConnected: socket?.connected ?? false,
    },
    focus: {
      status: focusState.status,
      isFocusTimerRunning: focusState.isFocusTimerRunning,
      focusTimeSeconds: focusState.getFocusTime(),
    },
    activeModal: modalState.activeModal,
  };

  // 최근 콘솔 로그
  const recentLogs = getRecentLogs();

  return {
    environment,
    appState,
    recentLogs,
  };
}
