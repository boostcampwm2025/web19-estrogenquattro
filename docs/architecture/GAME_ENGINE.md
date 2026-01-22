# Phaser 게임 엔진 구조

## 개요

Phaser 3 Arcade Physics 기반의 2D 멀티플레이어 게임

## 게임 설정

```typescript
// frontend/src/game/config.ts
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
    },
  },
  scene: [MapScene],
};
```

---

## Scene 구조

### MapScene

메인 게임 화면을 담당하는 Scene

```
MapScene
├── preload()     # 에셋 로드 (맵 이미지, 스프라이트 시트, Tiled JSON)
├── create()      # 게임 오브젝트 생성, 소켓 이벤트 바인딩
└── update()      # 프레임별 업데이트 (플레이어 이동 처리)
```

**주요 책임:**
- 맵 렌더링 및 충돌 영역 설정
- 로컬 플레이어 (Player) 생성 및 조작
- 원격 플레이어 (RemotePlayer) 동기화
- UI 컴포넌트 (프로그레스바, 기여도 목록) 관리
- Socket.io 이벤트 처리

---

## Player 클래스 구조

```
BasePlayer (추상 클래스)
├── 렌더링: 얼굴 스프라이트, 몸통 애니메이션
├── Physics: Arcade Physics Body
├── UI: 닉네임 텍스트, 접속 시간
└── 채팅: 말풍선 표시

Player extends BasePlayer
├── 키보드 입력 처리
├── 이동 이벤트 전송 (moving)
└── 카메라 팔로우

RemotePlayer extends BasePlayer
├── 서버 위치 데이터 수신
├── Lerp 기반 부드러운 이동
├── 애니메이션 동기화
└── 집중 상태/시간 실시간 표시
```

### Player (로컬 플레이어)

```typescript
// frontend/src/game/players/Player.ts
export class Player extends BasePlayer {
  // 키보드 입력 → Arcade Physics 이동
  // moving 이벤트 전송 (30ms 쓰로틀)
}
```

### RemotePlayer (원격 플레이어)

```typescript
// frontend/src/game/players/RemotePlayer.ts
export class RemotePlayer extends BasePlayer {
  // 서버에서 수신한 위치로 Lerp 이동
  // 방향에 따른 애니메이션 재생
  // 집중 상태 및 시간 표시
}
```

**FocusTime 기능:**

- `setFocusState(isFocusing, options)`: 집중/휴식 상태 설정
- 집중 중일 때 1초마다 경과 시간 UI 업데이트 (로컬 계산)
- `options.taskName`: 현재 작업 중인 태스크 이름 (말풍선 표시)
- `options.lastFocusStartTime`: 집중 시작 시각 (경과 시간 계산용)
- `options.totalFocusSeconds`: 누적 집중 시간 (초)

---

## 맵 시스템

### 에셋 구조

```
frontend/public/assets/
├── tempMap1.png          # 맵 이미지 1
├── tempMap2.png          # 맵 이미지 2
├── temp1Tilemap.json     # Tiled 충돌 데이터 1
├── temp2Tilemap.json     # Tiled 충돌 데이터 2
└── body.png              # 캐릭터 스프라이트 시트
```

### Tiled JSON 충돌 영역

Tiled 에디터로 충돌 영역을 정의하고 JSON으로 export

```json
{
  "layers": [
    {
      "name": "Collisions",
      "objects": [
        {
          "class": "wall",
          "x": 100,
          "y": 200,
          "width": 32,
          "height": 32
        }
      ]
    }
  ]
}
```

### 맵 전환

프로그레스바 100% 도달 시 다음 맵으로 전환

```typescript
// 맵 인덱스 순환
this.currentMapIndex = (this.currentMapIndex + 1) % this.mapConfigs.length;
// 새 맵 로드 및 충돌 영역 재설정
```

---

## UI 컴포넌트

### 프로그레스바

```typescript
// frontend/src/game/ui/createProgressBar.ts
export interface ProgressBarController {
  addProgress(amount: number): void;
  reset(): void;
  getProgress(): number;
  setProgress(value: number): void;
}
```

- Phaser Graphics로 렌더링
- 맵 좌표 기준 중앙 상단 배치
- Tween 애니메이션으로 부드러운 진행

### 기여도 목록

```typescript
// frontend/src/game/ui/createContributionList.ts
export interface ContributionListController {
  updateContributions(contributions: Record<string, number>): void;
  destroy(): void;
}
```

- 상위 5명 기여도 순 정렬 표시
- username: count 형식

---

## Socket.io 연동

### 이벤트 바인딩 (create)

```typescript
socket.on('players_synced', (players) => {
  // 기존 플레이어들 RemotePlayer로 생성
  // FocusTime 상태(status, lastFocusStartTime, totalFocusSeconds) 반영
});

socket.on('player_joined', (data) => {
  // 새 플레이어 RemotePlayer 생성
});

socket.on('moved', (data) => {
  // RemotePlayer 위치 업데이트
});

socket.on('github_event', (data) => {
  // 프로그레스바 업데이트
});

socket.on('focused', (data) => {
  // RemotePlayer 집중 상태로 전환
  // taskName, lastFocusStartTime, totalFocusSeconds 반영
});

socket.on('rested', (data) => {
  // RemotePlayer 휴식 상태로 전환
  // totalFocusSeconds 업데이트
});
```

### 이벤트 전송 (update)

```typescript
// 이동 중일 때만 전송 (쓰로틀 적용)
socket.emit('moving', {
  x: player.x,
  y: player.y,
  isMoving: true,
  direction: currentDirection,
  timestamp: Date.now(),
});
```

---

## 애니메이션

### 캐릭터 스프라이트 시트

```
body.png (4방향 x 4프레임)
├── Row 0: 아래 방향 걷기
├── Row 1: 왼쪽 방향 걷기
├── Row 2: 오른쪽 방향 걷기
└── Row 3: 위쪽 방향 걷기
```

### 애니메이션 정의

```typescript
this.anims.create({
  key: 'walk_down',
  frames: this.anims.generateFrameNumbers('body', { start: 0, end: 3 }),
  frameRate: 8,
  repeat: -1,
});
```
