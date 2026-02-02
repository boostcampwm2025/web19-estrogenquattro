# Issue #373: 자정 포인트 정산 시 맵 전환 검은 화면 수정

**상태:** ✅ 해결됨
**브랜치:** `fix/#373-map-switch-black-screen`

---

## 문제 요약

KST 자정에 `PointSettlementScheduler`가 실행되어 포인트가 정산되면서 progress가 100%를 여러 번 넘을 때, `map_switch` 이벤트가 빠르게 연속 emit되어 클라이언트에서 검은 화면이 발생했습니다.

---

## 원인 분석 (검증됨)

### 원인 체인

```
원인 A: 서버에서 map_switch 빠르게 4번 emit (3→4→0→1→2, 약 1초 내)
    ↓
원인 B: 클라이언트에서 fadeOut 4번 시작, camerafadeoutcomplete 4번 발생
    ↓
원인 C: load.start() 4번 동시 호출 → Phaser 로더 충돌 → textureExists=false
    ↓
결과: 검은 화면
```

### 서버 로그 (재현)

```
21:11:01 [ProgressGateway] Map switch triggered: 3 → 4
21:11:01 [ProgressGateway] Map switch triggered: 4 → 0
21:11:02 [ProgressGateway] Map switch triggered: 0 → 1
21:11:02 [ProgressGateway] Map switch triggered: 1 → 2
```

### 클라이언트 로그 (버그 재현 시)

```
[SocketManager] map_switch received: { mapIndex: 2 }
[MapManager] switchToMap called: mapIndex=2, currentMapIndex=3
[MapManager] Starting fadeOut
[MapManager] fadeOut complete  ← 4번 발생!
[MapManager] loadAndSetup called: mapIndex=4
[MapManager] loadAndSetup called: mapIndex=0
[MapManager] loadAndSetup called: mapIndex=1
[MapManager] loadAndSetup called: mapIndex=2
[MapManager] load.once("complete") fired: textureExists=false  ← 텍스처 없음!
```

### 원인 상세

1. **서버: 빠른 연속 map_switch emit**
   - 정산 시 각 focusTime 레코드마다 `addProgress` 개별 호출
   - 짧은 시간 내에 progress가 100%를 여러 번 도달
   - 각 100% 도달마다 `map_switch` 이벤트 emit

2. **클라이언트: 중복 fadeOut 발생**
   - `map_switch` 이벤트가 빠르게 연속 도착
   - 각 이벤트마다 `switchToMap` 호출 → `fadeOut` 시작
   - `camerafadeoutcomplete` 이벤트가 여러 번 발생
   - 각 완료 콜백에서 `loadAndSetup` 호출

3. **Phaser 로더 충돌**
   - 여러 `load.start()`가 동시 호출
   - `load.once("complete")`가 다른 로드 작업 완료에 의해 먼저 트리거
   - `textureExists=false` 상태에서 `setup()` 호출 → 검은 화면

---

## 적용된 해결책

### SocketManager에서 map_switch 디바운스 (1초)

**파일:** `frontend/src/game/managers/SocketManager.ts`

```typescript
// 클래스 필드 추가
private mapSwitchTimeout: ReturnType<typeof setTimeout> | null = null;

// map_switch 이벤트 핸들러
socket.on("map_switch", (data: { mapIndex: number }) => {
  console.log("[SocketManager] map_switch received:", data);

  if (this.mapSwitchTimeout) {
    clearTimeout(this.mapSwitchTimeout);
  }

  this.mapSwitchTimeout = setTimeout(() => {
    console.log("[SocketManager] map_switch debounced, processing:", data);
    if (data.mapIndex === this.currentMapIndex) return;
    this.currentMapIndex = data.mapIndex;
    callbacks.onMapSwitch(data.mapIndex);
  }, 1000);
});
```

### 동작 원리

```
map_switch(4) 도착 → 디바운스 1초 시작
    ↓ 100ms
map_switch(0) 도착 → 타이머 리셋
    ↓ 100ms
map_switch(1) 도착 → 타이머 리셋
    ↓ 100ms
map_switch(2) 도착 → 타이머 리셋
    ↓ 1초 후
onMapSwitch(2) 실행 → 마지막 mapIndex만 처리 ✅
```

---

## 추가 방어 (서버)

서버의 `MapController`에서 맵 접근 권한 체크가 추가 방어 역할을 합니다:

```
[MapController] Map request: index=4, currentMapIndex=2
[MapController] Map access denied: requested=4, current=2  ← 거부
[MapController] Map request: index=2, currentMapIndex=2    ← 허용
```

---

## 테스트 결과

| 테스트 | 결과 |
|--------|------|
| 정산 시 map_switch 4번 emit | ✅ 서버에서 확인 |
| 디바운스로 마지막 mapIndex만 처리 | ✅ 클라이언트에서 확인 |
| 검은 화면 발생 안 함 | ✅ 정상 전환 확인 |

---

## 수정된 파일

| 파일 | 변경 내용 |
|-----|----------|
| `frontend/src/game/managers/SocketManager.ts` | `mapSwitchTimeout` 필드 추가, map_switch 1초 디바운스 |

---

## 미적용 해결책 (참고)

### 서버 일괄 처리 (Phase 2)

정산 시 `addProgressBatch`로 progress를 한 번에 계산하고 `map_switch`를 최종 결과에 대해 1번만 emit하는 방식. 현재 클라이언트 디바운스로 충분히 해결되어 미적용.

### MapManager isTransitioning 플래그

전환 중이면 새 요청을 큐에 저장하는 방식. 연속된 유효한 맵 전환도 막을 수 있어서 디바운스 방식으로 대체.
