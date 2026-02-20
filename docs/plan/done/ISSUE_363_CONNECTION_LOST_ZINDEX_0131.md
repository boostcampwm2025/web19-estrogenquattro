# Issue #363: 서버 연결 끊김 알림 z-index 수정

## 문제 분석

### 현상
- 프로필/리더보드 모달이 열린 상태에서 서버 연결이 끊기면, "서버와의 연결이 끊어졌습니다" 알림이 모달 **아래**에 표시됨

### 원인
- 연결 끊김 오버레이는 Phaser 게임 캔버스 내부에서 렌더링됨 (`MapScene.ts:355-418`)
- Phaser 내부 depth 값 (`setDepth(1000)`)은 **Phaser 캔버스 내부**에서만 유효
- React 모달 (`UserInfoModal`, `LeaderboardModal`)은 `z-50`으로 설정됨
- Phaser 캔버스(`#game-container`)는 DOM 계층에서 React 모달보다 아래에 위치
- → Phaser 내부 depth와 상관없이 React 모달에 가려짐

### 관련 코드
| 파일 | 역할 |
|------|------|
| `frontend/src/game/scenes/MapScene.ts:355-418` | 연결 끊김 오버레이 (Phaser 내부) |
| `frontend/src/app/_components/UserInfoModal/index.tsx:70` | 프로필 모달 (z-50) |
| `frontend/src/app/_components/LeaderboardModal/LeaderboardModal.tsx:108` | 리더보드 모달 (z-50) |
| `frontend/src/game/managers/SocketManager.ts:173` | 연결 끊김 시 콜백 호출 |

---

## 해결 방안

### 선택: 연결 끊김 오버레이를 React 컴포넌트로 이동

**장점:**
- z-index 충돌 문제 완전 해결 (`z-[110]` 설정으로 모달 위에 표시)
- 모든 상황에서 일관된 UX 보장
- Phaser 캔버스와 React DOM 계층 분리

**구현:**
1. 연결 상태를 관리하는 Zustand 스토어 추가
2. React 연결 끊김 오버레이 컴포넌트 생성 (`z-[110]`)
3. `SocketManager`에서 스토어 상태 업데이트
4. 기존 Phaser 오버레이 코드 제거

**z-index 참고:** 프로젝트에서 이미 arbitrary values 패턴 사용 중
- `z-[50]` - ProgressBar
- `z-[99]` - OnboardingHighlight
- `z-[100]` - OnboardingTour DialogBox

---

## 구현 계획

### 1단계: Zustand 스토어 생성

**파일:** `frontend/src/stores/useConnectionStore.ts`

```typescript
import { create } from "zustand";

interface ConnectionState {
  isDisconnected: boolean;
  setDisconnected: (value: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isDisconnected: false,
  setDisconnected: (value) => set({ isDisconnected: value }),
}));
```

### 2단계: React 오버레이 컴포넌트 생성

**파일:** `frontend/src/_components/ConnectionLostOverlay.tsx`

> **경로 선택 이유:** `src/_components/`는 전역 공통 컴포넌트 (AuthGuard, Map, ClientOnly),
> `src/app/_components/`는 페이지 전용 컴포넌트. ConnectionLostOverlay는 전역에서 사용되므로 전자가 적합.

```typescript
"use client";

import { useConnectionStore } from "@/stores/useConnectionStore";

export default function ConnectionLostOverlay() {
  const isDisconnected = useConnectionStore((state) => state.isDisconnected);

  if (!isDisconnected) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/70">
      <p className="mb-4 text-2xl text-white">서버와의 연결이 끊어졌습니다.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg border-2 border-green-400 px-6 py-2 text-lg text-green-400 hover:bg-green-400/10"
      >
        새로고침
      </button>
    </div>
  );
}
```

### 3단계: SocketManager 수정

**파일:** `frontend/src/game/managers/SocketManager.ts`

콜백 방식 대신 스토어 직접 업데이트:
```typescript
import { useConnectionStore } from "@/stores/useConnectionStore";

// 연결 끊김 시 (disconnect 핸들러 내)
useConnectionStore.getState().setDisconnected(true);

// 재연결 시 (connect 핸들러 내)
useConnectionStore.getState().setDisconnected(false);
```

**콜백 제거 영향도 분석:**
- `showConnectionLostOverlay`, `hideConnectionLostOverlay` 콜백은 **MapScene.ts에서만** 정의/전달
- 다른 모듈에서 해당 콜백을 참조하는 곳 없음
- 테스트 코드(`socket-manager.spec.ts`)에서 모킹 시 해당 콜백 제거 필요
- Zustand 스토어는 React 외부에서도 `getState()` 로 접근 가능 (Phaser 코드에서 사용 가능)

### 4단계: page.tsx에 오버레이 추가

**파일:** `frontend/src/app/page.tsx`

```typescript
import ConnectionLostOverlay from "@/_components/ConnectionLostOverlay";

export default function Home() {
  return (
    <AuthGuard>
      <div className="relative h-screen w-screen overflow-hidden">
        <ClientOnly>
          <Map />
          <ProgressBar />
          <UserInfoModal />
          <LeaderboardModal />
          <OnboardingTour />
        </ClientOnly>
        {/* ... 기존 코드 ... */}
        <ConnectionLostOverlay />  {/* ← 마지막에 추가 (DOM 순서상 최상위) */}
      </div>
    </AuthGuard>
  );
}
```

> **삽입 위치:** `</div>` 바로 앞, 다른 모든 컴포넌트 뒤에 배치.
> `fixed` + `z-[110]`으로 DOM 순서와 무관하게 z-index가 적용되지만, 일관성을 위해 최하단에 배치.
>
> **ClientOnly 밖에 배치하는 이유:**
> - `ConnectionLostOverlay`는 `"use client"` 지시어를 가진 클라이언트 컴포넌트
> - SSR 시점에는 `isDisconnected=false`이므로 `null` 반환 → hydration mismatch 없음
> - `ClientOnly`는 Phaser(Map), 모달 등 SSR 불가능한 컴포넌트용이며, 단순 조건부 렌더링 컴포넌트는 밖에 둬도 무방
> - 만약 hydration 문제 발생 시 `ClientOnly` 내부로 이동하거나 `dynamic(..., { ssr: false })` 적용

### 5단계: 기존 Phaser 오버레이 제거

**파일:** `frontend/src/game/scenes/MapScene.ts`

- `showConnectionLostOverlay()` 메서드 제거
- `hideConnectionLostOverlay()` 메서드 제거
- 관련 필드 제거 (`connectionLostOverlay`, `connectionLostText`, `connectionLostButton`, `connectionLostButtonBorder`)
- 콜백 파라미터에서 제거

### 6단계: OnboardingTour 클릭 예외 처리

**파일:** `frontend/src/app/_components/OnboardingTour/OnboardingTour.tsx`

온보딩 중에는 window 레벨에서 모든 클릭 이벤트를 가로채서 차단하므로,
연결 끊김 오버레이의 "새로고침" 버튼도 차단됨. 예외 처리 추가:

```typescript
// handleClick 함수 내, 대화창 버튼 허용 로직 다음에 추가
// 연결 끊김 오버레이 클릭은 항상 허용 (서버 문제는 온보딩보다 우선)
if (target.closest('[class*="z-[110]"]')) {
  return;
}
```

---

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/stores/useConnectionStore.ts` | 신규 생성 |
| `frontend/src/_components/ConnectionLostOverlay.tsx` | 신규 생성 |
| `frontend/src/app/page.tsx` | 오버레이 컴포넌트 추가 |
| `frontend/src/game/managers/SocketManager.ts` | 콜백 → 스토어 업데이트 |
| `frontend/src/game/scenes/MapScene.ts` | Phaser 오버레이 코드 제거 |
| `frontend/src/app/_components/OnboardingTour/OnboardingTour.tsx` | 연결 끊김 오버레이 클릭 예외 처리 |

---

## z-index 계층 정리

| 요소 | z-index | 비고 |
|------|---------|------|
| UserInfoButton, LeaderboardButton | z-30 | `page.tsx:26` |
| FocusPanel | z-40 | `page.tsx:23` |
| UserInfoModal, LeaderboardModal | z-50 | 모달 백드롭 |
| ProgressBar | `z-[50]` | `ProgressBar.tsx` |
| OnboardingHighlight | `z-[99]` | 온보딩 하이라이트 |
| OnboardingTour DialogBox | `z-[100]` | 온보딩 대화상자 |
| **ConnectionLostOverlay** | **`z-[110]`** | **최상위 - 모든 UI 위에 표시** |

> **결정:** 연결 끊김은 모든 상황에서 최우선 알림이어야 하므로 `z-[110]`으로 설정.
> 온보딩 중이라도 서버 연결 끊김은 즉시 인지되어야 함.

---

## 테스트 계획

1. 프로필 모달 열린 상태에서 서버 연결 끊기 → 오버레이가 모달 위에 표시되는지 확인
2. 리더보드 모달 열린 상태에서 서버 연결 끊기 → 오버레이가 모달 위에 표시되는지 확인
3. **온보딩 진행 중 서버 연결 끊기 → 오버레이가 온보딩 UI 위에 표시되는지 확인**
4. **온보딩 진행 중 서버 연결 끊기 → 새로고침 버튼 클릭 가능한지 확인**
5. 모달 없이 서버 연결 끊기 → 기존과 동일하게 동작하는지 확인
6. 새로고침 버튼 클릭 → 페이지 리로드 동작 확인
7. 재연결 시 → 오버레이가 숨겨지는지 확인

---

## 참고 문서

- [STATE_MANAGEMENT.md](../architecture/STATE_MANAGEMENT.md) - Zustand 상태 관리
- [GAME_ENGINE.md](../architecture/GAME_ENGINE.md) - Phaser 게임 구조
