# Issue #308 & #388: 맵 순환 제거 및 점진적 프로그레스 기준값

## 관련 이슈

- [#308](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/308): feat: 맵 5 완료 후 맵 0 순환 제거
- [#388](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/388): chore: 맵 전환 프로그레스 기준값을 맵 인덱스별로 점진적 적용

## 참조한 문서

- [GAME_ENGINE.md](../architecture/GAME_ENGINE.md): 맵 전환 시퀀스, 맵 순환 상태
- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md): 프로그레스 계산 로직
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): map_switch, progress_update, game_state 이벤트

## 현재 구조

### 맵 순환 로직 (Issue #308)

```typescript
// backend/src/github/progress.gateway.ts:57, 234, 281
const MAP_COUNT = 5;

// 100% 도달 시 맵 전환
if (this.globalState.progress >= 100) {
  this.globalState.progress = 0; // 초과분 버림
  this.globalState.mapIndex = (this.globalState.mapIndex + 1) % MAP_COUNT;
  this.server.emit('map_switch', { mapIndex: this.globalState.mapIndex });
}
```

**현재 동작 (문제):**
- 맵 0 → 1 → 2 → 3 → 4 → **0** (순환)
- 맵 4(5번째)에서 100% 도달 시 `(4 + 1) % 5 = 0`으로 다시 맵 0으로 순환

**변경 요청:**
- 맵 0 → 1 → 2 → 3 → 4 (끝, 순환 없음)
- 맵 4에서 기준값 도달 시 맵 전환 없이 유지
- **맵 4에서 progress가 기준값(500)에 도달하면 더 이상 증가하지 않음**
- 시즌 리셋 시에만 맵 0으로 초기화

### 프로그레스 기준값 (Issue #388)

**현재:** 모든 맵에서 100% 고정 기준값
```typescript
// 모든 맵에서 동일하게 100 기준
if (this.globalState.progress >= 100) {
  // 맵 전환
}
```

**요구사항:** 맵 인덱스별 점진적 기준값
| 맵 전환 | 기준값 |
|---------|--------|
| 맵 0 → 맵 1 | 200 |
| 맵 1 → 맵 2 | 300 |
| 맵 2 → 맵 3 | 400 |
| 맵 3 → 맵 4 | 500 |
| 맵 4 | 500 도달 시 멈춤 (전환 없음) |

### 프론트엔드 프로그레스바 UI

```typescript
// frontend/src/_components/ui/ProgressBar.tsx:7-8
const SECTION_COUNT = 24;
const TOTAL_STAGES = 5;

// 현재: 100% 기준으로 고정 계산
const filledSections = Math.floor((displayProgress / 100) * SECTION_COUNT);
```

**요구사항:** 현재 맵의 기준값에 맞게 표시

## 변경 계획

### 1. 백엔드: 맵 순환 제거 및 점진적 기준값 적용

**수정 파일:** `backend/src/github/progress.gateway.ts`

```typescript
// 맵 인덱스별 기준값 배열
const MAP_PROGRESS_THRESHOLDS = [200, 300, 400, 500, 500]; // 맵 0→1, 1→2, 2→3, 3→4, 마지막맵상한
const MAX_MAP_INDEX = 4; // 마지막 맵 인덱스

// 현재 맵의 기준값 조회
private getProgressThreshold(): number {
  return MAP_PROGRESS_THRESHOLDS[this.globalState.mapIndex];
}

// progress 추가 시 마지막 맵 상한 체크
private addProgressInternal(amount: number): number {
  const threshold = this.getProgressThreshold();
  const isLastMap = this.globalState.mapIndex >= MAX_MAP_INDEX;

  if (isLastMap) {
    // 마지막 맵: 기준값(500) 이상으로 올라가지 않음
    this.globalState.progress = Math.min(
      this.globalState.progress + amount,
      threshold
    );
  } else {
    this.globalState.progress += amount;

    // 기준값 도달 시 맵 전환
    if (this.globalState.progress >= threshold) {
      this.globalState.progress = 0;
      this.globalState.mapIndex += 1; // 순환 없이 증가
      this.server.emit('map_switch', { mapIndex: this.globalState.mapIndex });
    }
  }

  return this.globalState.progress;
}
```

### 2. 소켓 이벤트 수정: 기준값 전달

**수정 파일:** `backend/src/github/progress.gateway.ts`

`game_state` 및 `progress_update` 이벤트에 `progressThreshold` 추가:

```typescript
// GameStateData 인터페이스 수정
export interface GameStateData {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;
  progressThreshold: number; // 추가: 현재 맵의 기준값
}

// ProgressUpdateData 인터페이스 수정
export interface ProgressUpdateData {
  username: string;
  source: ProgressSource;
  targetProgress: number;
  contributions: Record<string, number>;
  mapIndex: number;
  progressThreshold: number; // 추가: 현재 맵의 기준값
}
```

### 3. 프론트엔드: 프로그레스바 UI 수정

**수정 파일:**
- `frontend/src/stores/useProgressStore.ts`
- `frontend/src/_components/ui/ProgressBar.tsx`

```typescript
// useProgressStore.ts
interface ProgressStore {
  progress: number;
  mapIndex: number;
  progressThreshold: number; // 추가
  // ...
  setProgressThreshold: (threshold: number) => void;
}

// ProgressBar.tsx
const progressThreshold = useProgressStore((state) => state.progressThreshold);
const mapIndex = useProgressStore((state) => state.mapIndex);

const isLastMap = mapIndex >= 4;

// 기준값 기반으로 퍼센트 계산
const progressPercent = Math.min((displayProgress / progressThreshold) * 100, 100);
const filledSections = Math.floor((progressPercent / 100) * SECTION_COUNT);

// 마지막 맵이고 100% 도달 시 "COMPLETE" 표시 (선택)
const labelText = isLastMap && progressPercent >= 100
  ? "STAGE COMPLETE!"
  : `NEXT STAGE LOADING... (${currentStage}/${TOTAL_STAGES})`;
```

### 4. 소켓 매니저 수정

**수정 파일:** `frontend/src/game/managers/SocketManager.ts`

`game_state` 및 `progress_update` 이벤트 핸들러에서 `progressThreshold` 처리:

```typescript
socket.on('game_state', (data) => {
  useProgressStore.getState().setProgress(data.progress);
  useProgressStore.getState().setMapIndex(data.mapIndex);
  useProgressStore.getState().setProgressThreshold(data.progressThreshold);
});

socket.on('progress_update', (data) => {
  useProgressStore.getState().setProgress(data.targetProgress);
  useProgressStore.getState().setProgressThreshold(data.progressThreshold);
});
```

### 5. 문서 업데이트

**수정 파일:**
- `docs/api/SOCKET_EVENTS.md`: game_state, progress_update 이벤트에 progressThreshold 필드 추가
- `docs/architecture/GAME_ENGINE.md`: 맵 순환 제거 및 점진적 기준값 설명 추가

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/progress.gateway.ts` | 맵 순환 제거, MAP_PROGRESS_THRESHOLDS 배열 추가, 마지막 맵 상한 처리 |
| `frontend/src/stores/useProgressStore.ts` | progressThreshold 상태 및 setter 추가 |
| `frontend/src/_components/ui/ProgressBar.tsx` | progressThreshold 기반 계산, 마지막 맵 UI 처리 |
| `frontend/src/game/managers/SocketManager.ts` | progressThreshold 이벤트 핸들러 추가 |
| `docs/api/SOCKET_EVENTS.md` | 이벤트 페이로드 문서 업데이트 |
| `docs/architecture/GAME_ENGINE.md` | 맵 순환 제거 및 기준값 문서 업데이트 |

## 테스트 계획

### 맵 순환 제거 테스트 (Issue #308)
- [x] 맵 4에서 기준값(500) 도달해도 맵 전환되지 않는지 확인
- [x] 맵 4에서 progress가 500 이상으로 증가하지 않는지 확인
- [x] 맵 4에서 프로그레스바가 100%에서 멈추는지 확인
- [ ] 시즌 리셋 시에만 맵 0으로 초기화되는지 확인

### 점진적 기준값 테스트 (Issue #388)
- [x] 맵 0에서 200 도달 시 맵 1로 전환 확인
- [x] 맵 1에서 300 도달 시 맵 2로 전환 확인
- [x] 맵 2에서 400 도달 시 맵 3으로 전환 확인
- [x] 맵 3에서 500 도달 시 맵 4로 전환 확인

### 프론트엔드 UI 테스트
- [x] 프로그레스바가 현재 맵의 기준값에 맞게 표시되는지 확인
- [x] 맵 전환 시 프로그레스바가 0%로 리셋되는지 확인
- [x] 마지막 맵(맵 4)에서 프로그레스바가 100%에서 고정되는지 확인
- [x] 마지막 맵(맵 4) 도달 시 바로 "STAGE COMPLETE!" 표시되는지 확인
- [x] 신규 접속/재접속 시 올바른 기준값으로 표시되는지 확인

### 시즌 리셋 테스트
- [ ] 시즌 리셋 시 맵 0으로 이동하고 기준값 200으로 설정되는지 확인
- [ ] 시즌 리셋 시 contributions 초기화되는지 확인

## 브랜치

```
feat/#308-388-map-progressive-threshold
```

## 재현 방법 (디버그 API) - 제거됨

> **참고:** 테스트 완료 후 디버그 API가 제거되었습니다 (2026-02-03).
>
> 테스트 시 사용했던 API:
> - `GET /api/maps/debug/state` - 현재 상태 조회
> - `GET /api/maps/debug/fake-commit` - 가짜 커밋으로 progress +10

## 참고사항

- **맵 4 동작**: progress는 500(기준값)까지만 증가, 그 이상 증가하지 않음
- **시즌 리셋**: 매주 월요일 00:00 KST에 맵 0으로 초기화, contributions 초기화
- **마지막 맵 UI**: 프로그레스바 100% 고정, 라벨을 "STAGE COMPLETE!" 등으로 변경 가능

## 시즌 리셋과의 차이 (최종)

| 구분 | 맵 전환 (기준값 도달) | 시즌 리셋 (매주 월요일) |
|------|----------------------|------------------------|
| progress | 0으로 리셋 | 0으로 리셋 |
| contributions | 유지 | 초기화 (`{}`) |
| mapIndex | 다음 맵으로 이동 (맵 4 제외) | 0으로 리셋 |
| 이벤트 | `map_switch` | `season_reset` |
| 맵 4에서 | 전환 없음, progress 500에서 멈춤 | 맵 0으로 리셋 |
