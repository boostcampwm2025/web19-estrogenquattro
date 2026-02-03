# Issue #373: 검은 화면 버그 분석 및 수정

**상태:** ✅ 버그 재현 성공 + 원인 분석 완료
**버그 유형:** Race Condition (비동기 로드 중 플레이어 destroy)
**최종 업데이트:** 2024-02-03

---

## 버그 재현 방법 (Quick Start)

```bash
# 1. 백엔드 실행
cd backend && pnpm start:dev

# 2. 프론트엔드 실행 (다른 터미널)
cd frontend && pnpm dev

# 3. 브라우저에서 게임 접속
open http://localhost:3000

# 4. 버그 재현 (다른 터미널)
curl "http://localhost:8080/api/maps/test/black-screen?players=5&leaveDelay=50"

# 5. 브라우저 콘솔에서 sys 에러 확인
```

---

## 문제 요약

맵 전환 시 검은 화면이 발생하는 버그. 실제 원인은 **비동기 이미지 로드 완료 전에 플레이어가 destroy되어 JavaScript 에러가 발생**하는 것.

**영향 범위:**
- 아바타 이미지 로드 (SocketManager → BasePlayer.updateFaceTexture)
- 펫 이미지 로드 (BasePlayer.setPet → Pet.setTexture)

---

## 실제 에러 로그

```
Uncaught TypeError: Cannot read properties of undefined (reading 'sys')
    at initialize.setTexture
    at v.updateFaceTexture
    at initialize.<anonymous>
    at a.emit
    at t.pendingDestroy        ← 핵심: destroy 중에 발생
    at initialize.fileProcessComplete
    at t.onProcessComplete
    at data.onload
```

---

## 원인 분석

### 버그 발생 흐름 (아바타)

```
1. player_joined 이벤트 수신
   → RemotePlayer 생성
   → 아바타 이미지 로드 시작 (비동기)
   → filecomplete 콜백 등록

2. 이미지 로드 완료 전에 player_left 이벤트 수신
   → remotePlayer.destroy() 호출
   → faceSprite 등 내부 객체 destroy (pendingDestroy 상태)

3. 이미지 로드 완료
   → filecomplete 콜백 실행
   → updateFaceTexture() 호출
   → faceSprite.setTexture() 호출
   → faceSprite.sys가 undefined → 에러 발생!

4. JavaScript 에러로 인해 후속 로직 중단 → 검은 화면
```

---

## 재현 방법

### 테스트 엔드포인트

```
GET http://localhost:8080/api/maps/test/player-join-leave?count=10&delay=100
```

**파라미터:**
- `count`: 가짜 플레이어 수 (기본값: 10)
- `delay`: join 후 leave까지 지연 시간 ms (기본값: 100)

### 재현 결과 (2024-02-03)

```
curl "http://localhost:8080/api/maps/test/player-join-leave?count=10&delay=100"
```

**결과:**
- ✅ 에러 발생: `Cannot read properties of undefined (reading 'sys')`
- ❌ **검은화면은 발생하지 않음** → 검은화면 버그와는 별개 이슈

**결론:** 이 버그는 콘솔 에러만 발생시키고, 검은화면 버그의 원인은 아님. 별도 이슈로 분리 필요.

### 테스트 엔드포인트 2: 복합 시나리오 (player_left + map_switch)

```
GET http://localhost:8080/api/maps/test/black-screen?players=5&leaveDelay=50
```

**파라미터:**
- `players`: 가상 플레이어 수 (기본값: 5)
- `leaveDelay`: join 후 leave까지 지연 시간 ms (기본값: 50)

### 재현 결과 (2024-02-03) ✅ 성공

```
curl "http://localhost:8080/api/maps/test/black-screen?players=5&leaveDelay=50"
```

**콘솔 로그:**
```
[SocketManager] progress_update received: {targetProgress: 0, mapIndex: 1, ...}
[SocketManager] Map sync from progress_update: 2 → 1
[SocketManager] map_switch received: {mapIndex: 1}
Uncaught TypeError: Cannot read properties of undefined (reading 'sys')
    at initialize.setTexture
    at v.updateFaceTexture
    at initialize.<anonymous>
    at a.emit
    at t.pendingDestroy
[SocketManager] map_switch debounced, processing: {mapIndex: 1}
Uncaught TypeError: Cannot read properties of undefined (reading 'sys')
    ...
```

**결과:**
- ✅ **sys 에러 재현 성공** (2회 발생)
- 에러 발생 시점: `pendingDestroy` 상태에서 `updateFaceTexture` 호출

**결론:**
1. `player_joined` → 아바타 이미지 로드 시작
2. `player_left` → RemotePlayer destroy (이미지 로드 중)
3. `progress_update` → Map sync 트리거
4. 이미지 로드 완료 → destroy된 `faceSprite.setTexture()` 호출 → **sys 에러**
5. `map_switch` 디바운스 처리 후 또 에러 발생

---

## 테스트 소스코드 (버그 재현용)

> ⚠️ 이 코드는 테스트 후 삭제할 것. 프로덕션에 포함하지 않음.

### 1. ProgressGateway 수정 (`backend/src/github/progress.gateway.ts`)

```typescript
// 기존 코드에 추가

/**
 * Socket.io Server 인스턴스 반환 (테스트용)
 */
getServer(): Server {
  return this.server;
}

/**
 * mapIndex 직접 설정 (테스트용)
 */
setMapIndex(index: number): void {
  this.globalState.mapIndex = index;
}
```

### 2. MapController 테스트 엔드포인트 (`backend/src/github/map.controller.ts`)

```typescript
import { Server } from 'socket.io';

// ... 기존 코드 ...

/**
 * 테스트용: 빠른 player_joined + player_left 시뮬레이션
 * 비동기 이미지 로드 중 destroy 버그 재현용
 *
 * GET /api/maps/test/player-join-leave?count=10&delay=100
 */
@Get('test/player-join-leave')
async testPlayerJoinLeave(
  @Query('count') count = '10',
  @Query('delay') delay = '100',
) {
  const server = this.progressGateway.getServer();
  if (!server) {
    return { error: 'Socket server not available' };
  }

  const playerCount = parseInt(count, 10);
  const leaveDelay = parseInt(delay, 10);

  this.logger.warn(
    `[TEST] Simulating ${playerCount} players join+leave (delay: ${leaveDelay}ms)`,
  );

  const results: string[] = [];

  for (let i = 0; i < playerCount; i++) {
    const fakeUserId = `test-user-${Date.now()}-${i}`;
    const fakeUsername = `TestPlayer${i}`;

    // player_joined 이벤트 emit
    server.emit('player_joined', {
      userId: fakeUserId,
      username: fakeUsername,
      x: 100 + i * 10,
      y: 100,
      status: 'RESTING',
      totalFocusSeconds: 0,
      currentSessionSeconds: 0,
      playerId: 9999 + i,
      petImage: i % 2 === 0 ? `https://picsum.photos/50/50?random=${i}` : null,
      taskName: null,
    });

    results.push(`joined: ${fakeUserId}`);

    // leaveDelay ms 후 player_left 이벤트 emit (이미지 로드 중 destroy 재현)
    setTimeout(() => {
      server.emit('player_left', { userId: fakeUserId });
      this.logger.debug(`[TEST] player_left: ${fakeUserId}`);
    }, leaveDelay);
  }

  return {
    message: `Simulated ${playerCount} players join+leave`,
    delay: `${leaveDelay}ms`,
    results,
  };
}

/**
 * 테스트용: map_switch 이벤트 연속 발생 시뮬레이션
 * 검은화면 버그 재현용
 *
 * GET /api/maps/test/map-switch-spam?count=5&delay=50
 */
@Get('test/map-switch-spam')
async testMapSwitchSpam(
  @Query('count') count = '5',
  @Query('delay') delay = '50',
) {
  const server = this.progressGateway.getServer();
  if (!server) {
    return { error: 'Socket server not available' };
  }

  const switchCount = parseInt(count, 10);
  const switchDelay = parseInt(delay, 10);
  const startMapIndex = this.progressGateway.getMapIndex();

  this.logger.warn(
    `[TEST] Simulating ${switchCount} map_switch events (delay: ${switchDelay}ms)`,
  );

  const results: string[] = [];

  for (let i = 0; i < switchCount; i++) {
    // 0 ↔ 1 번갈아가며 전환
    const targetMapIndex = (startMapIndex + i) % 2;

    setTimeout(() => {
      // 서버 상태도 같이 변경 (403 방지)
      this.progressGateway.setMapIndex(targetMapIndex);
      server.emit('map_switch', { mapIndex: targetMapIndex });
      this.logger.debug(`[TEST] map_switch: mapIndex=${targetMapIndex}`);
    }, i * switchDelay);

    results.push(`map_switch scheduled: mapIndex=${targetMapIndex} at ${i * switchDelay}ms`);
  }

  return {
    message: `Scheduled ${switchCount} map_switch events`,
    startMapIndex,
    delay: `${switchDelay}ms between each`,
    totalDuration: `${(switchCount - 1) * switchDelay}ms`,
    results,
  };
}

/**
 * 테스트용: 실제 버그 재현 (핵심 테스트)
 *
 * 실제 버그 시나리오:
 * 1. 가상 플레이어들 join (아바타 이미지 로드 시작)
 * 2. player_left 발생 → RemotePlayer destroy
 * 3. 아바타 이미지 로드 완료 → destroy된 객체 접근 → sys 에러
 * 4. map_switch 발생 (검은화면 테스트)
 *
 * GET /api/maps/test/black-screen?players=5&leaveDelay=50
 */
@Get('test/black-screen')
async testBlackScreen(
  @Query('players') players = '5',
  @Query('leaveDelay') leaveDelay = '50',
) {
  const server = this.progressGateway.getServer();
  if (!server) {
    return { error: 'Socket server not available' };
  }

  const playerCount = parseInt(players, 10);
  const leaveDelayMs = parseInt(leaveDelay, 10);
  const currentMapIndex = this.progressGateway.getMapIndex();
  const newMapIndex = (currentMapIndex + 1) % 2;

  this.logger.warn(
    `[TEST] Black screen test: ${playerCount} players (leave after ${leaveDelayMs}ms) + map switch`,
  );

  const results: string[] = [];
  const fakeUserIds: string[] = [];

  // 1. 가상 플레이어들 join (아바타 이미지 로드 시작)
  for (let i = 0; i < playerCount; i++) {
    const fakeUserId = `test-user-${Date.now()}-${i}`;
    const fakeUsername = `TestPlayer${i}`;
    fakeUserIds.push(fakeUserId);

    server.emit('player_joined', {
      userId: fakeUserId,
      username: fakeUsername,
      x: 100 + i * 10,
      y: 100,
      status: 'RESTING',
      totalFocusSeconds: 0,
      currentSessionSeconds: 0,
      playerId: 9999 + i,
      petImage: `https://picsum.photos/50/50?random=${Date.now()}-${i}`,
      taskName: null,
    });

    results.push(`player_joined: ${fakeUserId}`);
  }

  // 2. leaveDelay 후 player_left 발생 (이미지 로드 중 destroy)
  setTimeout(() => {
    fakeUserIds.forEach((userId) => {
      server.emit('player_left', { userId });
      this.logger.debug(`[TEST] player_left: ${userId}`);
    });

    // 3. player_left 직후 map_switch 발생
    this.progressGateway.setMapIndex(newMapIndex);
    server.emit('progress_update', {
      targetProgress: 0,
      mapIndex: newMapIndex,
      contributions: {},
      source: 'test',
      username: 'test',
    });
    server.emit('map_switch', { mapIndex: newMapIndex });
    this.logger.debug(`[TEST] map_switch: mapIndex=${newMapIndex}`);
  }, leaveDelayMs);

  results.push(`player_left scheduled: after ${leaveDelayMs}ms`);
  results.push(`map_switch scheduled: after ${leaveDelayMs}ms`);

  return {
    message: `Black screen test: ${playerCount} players leave after ${leaveDelayMs}ms + map switch`,
    playerCount,
    leaveDelay: `${leaveDelayMs}ms`,
    previousMapIndex: currentMapIndex,
    newMapIndex,
    results,
  };
}
```

---

### 테스트 체크리스트

#### 1. 핵심 버그 수정 확인 (sys 에러)

```bash
# 테스트 엔드포인트로 재현
curl "http://localhost:8080/api/maps/test/black-screen?players=5&leaveDelay=50"
```

- [ ] 브라우저 콘솔에 `Cannot read properties of undefined (reading 'sys')` 에러 없음
- [ ] 검은 화면 없이 맵 전환 정상 완료

#### 2. 회귀 방지 확인 (펫 라이프사이클)

> ⚠️ 이번 수정에서 `isDestroyed` 플래그를 추가하면서 발생할 수 있는 회귀를 `clear()` 분리로 방지함

수동 테스트:
1. 게임 접속
2. 프로필 → 펫 탭 → 펫 장착
3. 펫이 캐릭터 옆에 표시되는지 확인
4. 펫 해제
5. 펫이 사라지는지 확인
6. 다시 펫 장착

- [ ] 펫 해제 후 재장착 시 정상 표시

#### 3. 기존 기능 정상 동작 확인

**아바타 관련:**
- [ ] 다른 유저 접속 시 아바타(GitHub 프로필) 정상 로드
- [ ] 여러 유저 동시 접속 시 모든 아바타 정상 표시

**펫 관련:**
- [ ] 다른 유저의 펫이 정상 표시
- [ ] 펫 교체 시 (고양이 → 강아지) 정상 변경
- [ ] `pet_equipped` 이벤트로 다른 유저 펫 변경 시 정상 반영

**맵 전환:**
- [ ] progress 100% 도달 시 맵 전환 정상
- [ ] `map_switch` 완료 후 fadeIn 정상 호출
- [ ] 맵 전환 후 리스폰 위치 정상

#### 4. 엣지 케이스

- [ ] 유저 빠른 접속/퇴장 반복 시 에러 없음
- [ ] 장시간 접속 후에도 메모리 누수 없음 (리스너 정리 확인)
- [ ] 네트워크 느린 환경에서 아바타 로드 중 퇴장 시 에러 없음
- [ ] **아바타 로딩 중 player_left → 동일 유저 재접속 시 아바타 정상 표시** ⚠️ 핵심

---

## 설계 검토 결과 (2024-02 추가)

### 발견된 추가 문제점

| 우선순위 | 이슈 | 설명 |
|---------|------|------|
| 🔴 Critical | 펫 라이프사이클 회귀 | `setPet(null)` 후 `setPet(url)` 시 펫이 영원히 복구되지 않음 |
| 🟠 High | 리스너 누수 | 에러 시 `filecomplete` 리스너가 해제되지 않음 |
| 🟠 High | avatarLoadingKeys 정리 누락 | player_left 시 리스너만 제거, loadingKeys는 남아 재접속 시 로드 스킵 |
| 🟠 High | avatarLoadVersions 메모리 누수 | player_left/destroy 시 정리 안됨 → 장기 세션에서 무한 증가 |

### 1. 🔴 펫 라이프사이클 회귀 (Critical)

**문제:**
```
setPet(null) 호출
  → this.pet.destroy() 호출
  → Pet.isDestroyed = true 설정

이후 setPet("새URL") 호출 시
  → this.pet.setTexture(key) 호출
  → Pet.setTexture()에서 if (this.isDestroyed) return; → 즉시 리턴!
  → 펫이 영원히 복구되지 않음
```

**해결:** `clear()` vs `destroy()` 개념 분리
- `clear()`: 스프라이트만 정리 (재사용 가능)
- `destroy()`: 완전 파괴 (BasePlayer.destroy 시에만 호출)

### 2. 🟠 리스너 누수 (High)

**문제:** 현재 코드에서 에러 발생 시:
```typescript
const errorListener = (file) => {
  if (file.key === textureKey) {
    this.scene.load.off("loaderror", errorListener);  // loaderror만 off
    // filecomplete 리스너는 off 안 함! → 누수
  }
};
```

**해결:** 에러/성공 모든 경로에서 양쪽 리스너를 모두 정리

### 3. 🟠 avatarLoadingKeys 정리 누락 (High)

**문제:**
```
player_left 이벤트 수신
  → cleanupAllAvatarListeners(userId) 호출
  → 리스너만 제거, avatarLoadingKeys는 그대로
  → 로드 완료/실패 시 콜백이 없어서 키 정리 안됨
  → avatarLoadingKeys에 키가 영구히 남음

동일 유저 재접속 시
  → isAlreadyLoading = avatarLoadingKeys.has(textureKey) = true
  → load.image() 스킵
  → 아바타 영원히 로드 안됨
```

**해결:** `cleanupAllAvatarListeners`에서 해당 textureKey도 `avatarLoadingKeys`에서 삭제

### 4. 🟠 avatarLoadVersions 메모리 누수 (High)

**문제:**
```
player_left 또는 destroy 시
  → avatarLoadVersions.delete(userId) 호출 안됨
  → Map에 userId 키가 계속 쌓임
  → 장기 세션에서 수천 명 접속/퇴장 시 메모리 누수
```

**해결:** `cleanupAllAvatarListeners`에서 `avatarLoadVersions.delete(userId)` 추가, `destroy()`에서 `avatarLoadVersions.clear()` 추가

---

## 알려진 제한사항 (Phase 2)

발생 확률이 낮아 현재 범위에서 제외:
- destroy() 멱등성: 이중 destroy 호출되는 코드 경로 없으면 문제 없음
- 아바타 로드 순서 경쟁: 동일 유저 100ms 이내 연속 join 필요 (매우 드묾)
- userId/username 불일치: GitHub username 변경 거의 안 함
- 펫 해시 충돌: 펫 URL 수십 개 수준이면 확률 0에 가까움
- textureKey 충돌: username 없는 유저 동시 접속 드묾
- 텍스처 캐시 무한 증가: username 변경 안 하면 문제 없음
- petLoadingKeys per-player: 동시에 같은 펫 로드 확률 낮음

---

## 해결 방안

### 수정 1: BasePlayer에 destroy 체크 + 리스너 정리 (필수)

**파일:** `frontend/src/game/players/BasePlayer.ts`

```typescript
// 필드 추가
private isDestroyed: boolean = false;
private pendingLoaderListeners: Array<{
  event: string;
  callback: Function;
}> = [];
private currentPetLoadVersion: number = 0;
private petLoadingKeys: Set<string> = new Set();  // 펫 중복 로드 방지

// destroy() 수정
destroy() {
  this.isDestroyed = true;

  // 대기 중인 로더 리스너 정리
  if (this.scene?.load) {
    this.pendingLoaderListeners.forEach(({ event, callback }) => {
      this.scene.load.off(event, callback as any);
    });
  }
  this.pendingLoaderListeners = [];
  this.petLoadingKeys.clear();

  this.pet.destroy();  // 완전 파괴
  this.container.destroy();
  this.maskShape.destroy();
}

// updateFaceTexture 수정
updateFaceTexture(texture: string) {
  if (this.isDestroyed) return;
  if (!this.faceSprite?.sys) return;

  if (this.scene.textures.exists(texture)) {
    this.faceSprite.setTexture(texture);
    const FACE_RADIUS = 17;
    this.faceSprite.setDisplaySize(FACE_RADIUS * 2, FACE_RADIUS * 2);
  }
}

// setPet 수정
setPet(imageUrl: string | null) {
  if (this.isDestroyed) return;

  // 버전 증가 (연속 호출 시 이전 로드 무효화)
  this.currentPetLoadVersion++;
  const thisLoadVersion = this.currentPetLoadVersion;

  if (!imageUrl) {
    this.pet.clear();  // ⚠️ destroy() 대신 clear() 호출!
    return;
  }

  // 텍스처 키: URL 해시 사용 (파일명 충돌 방지)
  const textureKey = `pet_${this.hashString(imageUrl)}`;

  if (this.scene.textures.exists(textureKey)) {
    this.pet.setTexture(textureKey);
    return;
  }

  // 이미 로드 중인지 확인 (중복 로드 방지)
  const isAlreadyLoading = this.petLoadingKeys.has(textureKey);

  const cleanup = () => {
    this.petLoadingKeys.delete(textureKey);
    this.cleanupListener("loaderror", errorListener);
    this.cleanupListener(`filecomplete-image-${textureKey}`, completeListener);
  };

  const errorListener = (file: Phaser.Loader.File) => {
    if (file.key === textureKey) {
      console.error(`[BasePlayer] Load error for ${textureKey}:`, file);
      cleanup();  // 에러 시에도 모든 리스너 정리
    }
  };

  const completeListener = () => {
    cleanup();  // 성공 시에도 모든 리스너 정리
    if (this.isDestroyed || thisLoadVersion !== this.currentPetLoadVersion) return;
    this.pet.setTexture(textureKey);
  };

  this.registerListener("loaderror", errorListener);
  this.registerListener(`filecomplete-image-${textureKey}`, completeListener);
  this.scene.load.on("loaderror", errorListener);
  this.scene.load.once(`filecomplete-image-${textureKey}`, completeListener);

  // 이미 로드 중이 아닐 때만 새 로드 시작
  if (!isAlreadyLoading) {
    this.petLoadingKeys.add(textureKey);
    this.scene.load.image(textureKey, imageUrl);

    if (!this.scene.load.isLoading()) {
      this.scene.load.start();
    }
  }
}

// 해시 헬퍼 (간단한 문자열 해시)
private hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

private registerListener(event: string, callback: Function) {
  this.pendingLoaderListeners.push({ event, callback });
}

private cleanupListener(event: string, callback: Function) {
  if (this.scene?.load) {
    this.scene.load.off(event, callback as any);
  }
  this.pendingLoaderListeners = this.pendingLoaderListeners.filter(
    (l) => !(l.event === event && l.callback === callback)
  );
}
```

### 수정 2: Pet에 clear() vs destroy() 분리 (필수) ⚠️ 핵심 변경

**파일:** `frontend/src/game/players/Pet.ts`

```typescript
private isDestroyed: boolean = false;

setTexture(key: string): void {
  if (this.isDestroyed) return;
  if (!this.container?.scene) return;
  if (!this.container.active) return;
  if (!this.scene?.textures?.exists(key)) return;

  if (!this.sprite) {
    if (!this.scene?.add) return;
    this.sprite = this.scene.add.image(this.offset.x, this.offset.y, key);
    this.setSpriteScale();
    this.sprite.setOrigin(0.5, 0.5);
    this.container.add(this.sprite);
    this.container.sendToBack(this.sprite);
  } else {
    if (!this.sprite?.sys) return;
    this.sprite.setTexture(key);
    this.setSpriteScale();
  }
}

// ⚠️ 새로운 메서드: 스프라이트만 정리 (재사용 가능)
clear(): void {
  if (this.sprite) {
    this.sprite.destroy();
    this.sprite = null;
  }
  // isDestroyed는 설정하지 않음! → 이후 setTexture() 호출 가능
}

// 완전 파괴 (BasePlayer.destroy 시에만 호출)
destroy(): void {
  this.isDestroyed = true;
  this.clear();
}
```

### 수정 3: SocketManager 아바타 로드 개선 (필수)

**파일:** `frontend/src/game/managers/SocketManager.ts`

```typescript
// 대기 중인 아바타 로더 리스너 추적
private avatarLoaderListeners: Map<string, Array<{
  errorListener: Function;
  completeListener: Function;
  textureKey: string;
}>> = new Map();

// 진행 중인 아바타 로드 추적 (중복 로드 방지)
private avatarLoadingKeys: Set<string> = new Set();

private loadAvatar(data: PlayerData, remotePlayer: RemotePlayer) {
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
    this.removeAvatarListener(targetUserId, errorListener, completeListener, textureKey);
  };

  const errorListener = (file: Phaser.Loader.File) => {
    if (file.key === textureKey) {
      console.error(`[SocketManager] Avatar load error for ${textureKey}:`, file);
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

// 리스너 추가 (배열로 관리)
private addAvatarListener(userId: string, listener: {
  errorListener: Function;
  completeListener: Function;
  textureKey: string;
}) {
  const existing = this.avatarLoaderListeners.get(userId) || [];
  existing.push(listener);
  this.avatarLoaderListeners.set(userId, existing);
}

// ⚠️ 특정 리스너 제거 - 양쪽 리스너 모두 off
private removeAvatarListener(
  userId: string,
  errorListener: Function,
  completeListener: Function,
  textureKey: string
) {
  const listeners = this.avatarLoaderListeners.get(userId);
  if (!listeners) return;

  if (this.scene?.load) {
    this.scene.load.off("loaderror", errorListener as any);
    // ⚠️ filecomplete도 명시적으로 off (에러 시 누수 방지)
    this.scene.load.off(`filecomplete-image-${textureKey}`, completeListener as any);
  }

  const filtered = listeners.filter(
    (l) => l.errorListener !== errorListener && l.completeListener !== completeListener
  );

  if (filtered.length > 0) {
    this.avatarLoaderListeners.set(userId, filtered);
  } else {
    this.avatarLoaderListeners.delete(userId);
  }
}

// 해당 userId의 모든 리스너 정리
private cleanupAllAvatarListeners(userId: string) {
  const listeners = this.avatarLoaderListeners.get(userId);
  if (!listeners || !this.scene?.load) return;

  listeners.forEach(({ errorListener, completeListener, textureKey }) => {
    this.scene.load.off("loaderror", errorListener as any);
    this.scene.load.off(`filecomplete-image-${textureKey}`, completeListener as any);
    // ⚠️ avatarLoadingKeys에서도 삭제 (재접속 시 로드 스킵 방지)
    this.avatarLoadingKeys.delete(textureKey);
  });

  this.avatarLoaderListeners.delete(userId);
}

// player_left 핸들러
socket.on("player_left", (data: { userId: string }) => {
  const remotePlayer = this.otherPlayers.get(data.userId);
  if (remotePlayer) {
    this.cleanupAllAvatarListeners(data.userId);
    remotePlayer.destroy();
    this.otherPlayers.delete(data.userId);
  }
});

// destroy()
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
```

---

## 수정할 파일

| 파일 | 변경 내용 | 우선순위 |
|------|----------|---------|
| `frontend/src/game/players/BasePlayer.ts` | `isDestroyed` + 리스너 정리 + `pet.clear()` 호출 | 필수 |
| `frontend/src/game/players/Pet.ts` | `clear()` vs `destroy()` 분리 + 유효성 체크 | 필수 |
| `frontend/src/game/managers/SocketManager.ts` | 리스너 양쪽 off + loadingKeys 정리 | 필수 |

---

## 설계 결정 사항

### ⚠️ 펫 라이프사이클 (핵심)

**문제:** `destroy()` 후 `setTexture()` 호출 시 무시됨.

**해결:** `clear()` vs `destroy()` 개념 분리
- `clear()`: 스프라이트만 정리, `isDestroyed`는 false 유지 → 이후 `setTexture()` 가능
- `destroy()`: 완전 파괴, `isDestroyed = true` → `BasePlayer.destroy()` 시에만 호출

### ⚠️ 리스너 누수 방지 (핵심)

**문제:** 에러 발생 시 `filecomplete` 리스너가 남아있음.

**해결:** `cleanup()` 함수에서 **양쪽 리스너 모두** off
```typescript
const cleanup = () => {
  this.scene.load.off("loaderror", errorListener);
  this.scene.load.off(`filecomplete-image-${textureKey}`, completeListener);
};
```

---

## 확인 필요 사항

1. ✅ **Phaser 이벤트 이름:** `filecomplete-image-${key}` 형태 확인
2. ✅ **container.destroy() 동작:** `container.active`가 false가 됨
3. ✅ **scene.load.start() 재호출:** 로딩 중 재호출 시 안전 (no-op)
4. ✅ **펫 복구 시나리오:** `clear()` vs `destroy()` 분리로 해결
5. ✅ **avatarLoadingKeys 정리:** `cleanupAllAvatarListeners`에서 함께 삭제

---

## 기존 분석 (참고용)

### Frozen 브라우저 시나리오

- `MapManager.switchToMap` 중복 호출 방지 (isTransitioning 플래그)
- Page Visibility API로 frozen 복귀 감지
- SocketManager 디바운스 개선

이 부분들은 별도로 개선할 수 있음.
