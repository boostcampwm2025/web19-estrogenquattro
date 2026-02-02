# Issue #328: 맵 전환 후 리스폰 위치 동기화

## 이슈 요약

맵 전환 후 리스폰된 플레이어의 위치가 다른 유저에게 동기화되지 않는 문제

## 재현 방법

1. 여러 유저가 같은 방에 접속
2. 프로그레스 100% 도달하여 맵 전환 발생
3. 맵 전환 후 다른 유저의 위치 확인

**✅ 재현 확인 완료**

## 문제 분석

### 현재 코드 흐름

```
서버: progress 100% 도달
  ↓
서버 → 클라이언트: map_switch { mapIndex }
  ↓
SocketManager.onMapSwitch(mapIndex)
  ↓
MapScene.performMapSwitch(mapIndex)
  ↓
this.player.setPosition(spawnPos.x, spawnPos.y)  ← 로컬만 변경, 서버 전송 없음
```

### 문제 원인

`MapScene.performMapSwitch()`에서 플레이어 리스폰 후 새 위치를 서버에 전송하지 않음:

```typescript
// frontend/src/game/scenes/MapScene.ts:310-314
if (this.player) {
  const spawnPos = this.mapManager.getRandomSpawnPosition();
  this.player.setPosition(spawnPos.x, spawnPos.y);
  // ❌ 서버에 새 위치 전송 없음
}
```

### 결과

- 리스폰된 유저 본인: 새 위치로 정상 이동
- 다른 유저 화면: 리스폰된 유저가 이전 위치에 그대로 표시

---

## 리뷰 피드백 검토

### moved 유실 위험 (High로 제기됨)

> 리스폰 직후 moving 브로드캐스트가 다른 클라이언트의 맵 전환 완료 전에 도착할 수 있어, 원격 플레이어가 아직 생성되지 않았거나 전환 중이면 위치 업데이트가 유실될 위험

**검토 결과: 일반적인 전환 시나리오에서는 유실 위험 낮음**

핵심은 **RemotePlayer가 맵 전환 시 유지되는지**입니다. 유지되면 이벤트 순서와 무관하게 정상 동작합니다.

> **Note**: `player_left`가 동시에 발생하는 경우(연결 불안정, 강제 퇴장 등)는 별도 처리가 필요할 수 있으나, 이는 맵 전환과 무관한 일반적인 연결 해제 시나리오입니다.

#### 코드 근거: otherPlayers 유지 확인

```typescript
// frontend/src/game/managers/SocketManager.ts:223-228 - player_left에서만 삭제
socket.on("player_left", (data: { userId: string }) => {
  const remotePlayer = this.otherPlayers.get(data.userId);
  if (remotePlayer) {
    remotePlayer.destroy();
    this.otherPlayers.delete(data.userId);  // ← 여기서만 삭제
  }
});

// frontend/src/game/managers/SocketManager.ts:457-460 - destroy()에서만 clear
destroy(): void {
  this.otherPlayers.forEach((player) => player.destroy());
  this.otherPlayers.clear();  // ← 씬 종료 시에만
}

// frontend/src/game/scenes/MapScene.ts:298-316 - performMapSwitch()
private performMapSwitch(mapIndex: number) {
  this.mapManager.switchToMap(mapIndex, () => {
    this.setupCollisions();
    this.setupUI();
    // ... otherPlayers를 건드리지 않음
  });
}
```

#### 순서별 시나리오 분석

**Case 1: B가 moved를 map_switch보다 먼저 받는 경우**
```
B: moved 수신 → otherPlayers.get(A) 성공 → 위치 업데이트 ✓
B: map_switch 수신 → 맵 전환 (RemotePlayer 유지, 위치도 유지) ✓
```

**Case 2: B가 map_switch를 먼저 받는 경우**
```
B: map_switch 수신 → 맵 전환 (RemotePlayer 유지) ✓
B: moved 수신 → otherPlayers.get(A) 성공 → 위치 업데이트 ✓
```

**결론: 일반적인 전환 시나리오에서는 두 경우 모두 정상 동작**

### direction 'down' 고정 (Medium)

> 원격 캐릭터가 항상 아래를 바라보는 부자연스러운 상태

**결정: 현재 설계 유지**

- 리스폰 시 기본 방향으로 'down' 사용
- 향후 필요 시 마지막 방향 저장하여 개선 가능

### 문서화 (Low)

> moving 이벤트를 리스폰 용도로 쓰는 결정이 문서화 필요

**결정: SOCKET_EVENTS.md에 주석 추가**

---

## 추가 질문 검토

### Q1. 맵 전환 중 moved 수신을 큐잉/무시하는 로직이 있나요?

**답변: 없음. 하지만 문제없음.**

- 맵 전환 중에도 `otherPlayers` Map이 유지됨 (코드 근거: 위 참조)
- `moved` 이벤트 수신 시 `otherPlayers.get(userId)`가 성공
- 별도 큐잉 없이 즉시 위치 업데이트 가능
- **이벤트 순서와 무관하게 정상 동작** (moved가 먼저 와도, map_switch가 먼저 와도 OK)

### Q2. 리스폰 좌표를 클라이언트가 결정하는 현재 설계를 유지하나요?

**답변: 유지.**

- 현재: `mapManager.getRandomSpawnPosition()`을 클라이언트에서 호출
- 치팅 가능성 존재 (임의 좌표 전송 가능)
- **결정**: 이 게임 특성상 치팅 방지보다 단순성 우선
- 향후 필요 시 서버 주도 리스폰으로 전환 가능

---

## 해결 방안 비교

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **1. moving 래퍼 (채택)** | 리스폰 후 moving 이벤트 전송 | 기존 인프라 재사용, 서버 변경 없음 | 의미상 부정확 |
| 2. 전용 이벤트 | `respawned` 이벤트 추가 | 명확한 의미 | 오버엔지니어링 |
| 3. 서버 주도 | map_switch에 좌표 포함 | 서버 권위적 | 큰 구조 변경 필요 |

---

## 최종 해결책: 방안 1 (moving 래퍼)

### 구현 계획

#### 1. SocketManager에 래퍼 메서드 추가

```typescript
// frontend/src/game/managers/SocketManager.ts

/**
 * 리스폰 위치를 서버에 전송 (moving 이벤트 래퍼)
 * - 맵 전환 후 플레이어 위치 동기화에 사용
 * - 기존 moving 이벤트 인프라 재사용
 */
public sendRespawnPosition(x: number, y: number): void {
  const socket = getSocket();
  if (!socket) return;

  socket.emit('moving', {
    x,
    y,
    isMoving: false,
    direction: 'down',
    timestamp: Date.now(),
  });
}
```

#### 2. MapScene.performMapSwitch()에서 호출

```typescript
// frontend/src/game/scenes/MapScene.ts
private performMapSwitch(mapIndex: number) {
  this.mapManager.switchToMap(mapIndex, () => {
    // ... 기존 설정 코드 ...

    // 플레이어 리스폰 + 위치 동기화
    if (this.player) {
      const spawnPos = this.mapManager.getRandomSpawnPosition();
      this.player.setPosition(spawnPos.x, spawnPos.y);
      this.socketManager.sendRespawnPosition(spawnPos.x, spawnPos.y);
    }
  });
}
```

#### 3. SOCKET_EVENTS.md 문서화

`moving` 이벤트 설명에 리스폰 용도 주석 추가

---

## 테스트 계획

1. **단일 유저 테스트**
   - 맵 전환 후 리스폰 위치 정상 여부

2. **다중 유저 테스트**
   - 유저 A, B 같은 방 접속
   - 프로그레스 100% 달성
   - 맵 전환 후 서로의 위치가 새 리스폰 위치로 표시되는지 확인

3. **엣지 케이스**
   - 맵 전환 중 이동 시도
   - 연속 맵 전환 (빠른 프로그레스 증가)

4. **레이스 상황 검증**
   - A가 map_switch 직후 즉시 moving emit
   - B는 로딩 지연 상황 (네트워크 지연/저사양 시뮬레이션)
   - B에서 moved 수신 시 A의 위치가 유실되지 않는지 확인
   - 검증 방법: 브라우저 DevTools Network throttling으로 B 지연 유발

---

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/game/managers/SocketManager.ts` | `sendRespawnPosition()` 메서드 추가 |
| `frontend/src/game/scenes/MapScene.ts` | `performMapSwitch()`에서 호출 |
| `docs/api/SOCKET_EVENTS.md` | moving 이벤트 리스폰 용도 문서화 |

## 관련 문서

- `docs/architecture/GAME_ENGINE.md` - 맵 전환 시퀀스
- `docs/api/SOCKET_EVENTS.md` - `moving`, `map_switch` 이벤트
