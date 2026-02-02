# 이슈 #386: 시즌 순위 contributions를 포인트 기반으로 변경

## 참조한 문서

- [POINT_SYSTEM.md](../features/POINT_SYSTEM.md): 포인트 획득 정책 (ACTIVITY_POINT_MAP)
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): game_state, progress_update 이벤트 명세
- [GAME_ENGINE.md](../architecture/GAME_ENGINE.md): 기여도 목록 UI 설명

---

## 변경 범위

> **현재 소스(GitHub, Task, Focus)에서 contributions를 포인트 기반으로 통일**

| 소스 | 현재 | 변경 후 | 반영 시점 |
|------|------|--------|----------|
| GitHub (커밋, PR 등) | 활동 횟수 | 포인트 | 실시간 (폴링 감지 시) |
| Task 완료 | 완료 횟수 | 포인트 | 정산 시점 (KST 자정, [스케줄러 참조](../../backend/src/scheduler/point-settlement.scheduler.ts#L26)) |
| Focus 30분 | 횟수 | 포인트 | 정산 시점 (KST 자정, [스케줄러 참조](../../backend/src/scheduler/point-settlement.scheduler.ts#L26)) |

> **Note**: Task/Focus는 현재처럼 정산 시점에 반영 유지. 실시간 반영은 별도 이슈로 분리.

> **Note**: 미래에 새로운 포인트 소스 추가 시:
> - GitHub 계열: `castProgressUpdate()` → `updateGlobalState()` 경로
> - Task/Focus 계열: `addProgress()` 경로
>
> point_history에서 파생하는 구조 개선은 별도 이슈로 논의.

이를 통해 프로그레스바 하단 순위와 리더보드 모달 순위가 일치하게 됨.

---

## 현재 구조

### contributions 데이터 흐름

```
GitHub 활동 감지 / Task 완료 / Focus 30분
    ↓
ProgressGateway.updateGlobalState() 또는 addProgress()
    ↓
contributionCount = 활동 횟수  ← 문제!
    ↓
contributions[username] += contributionCount
    ↓
game_state / progress_update 이벤트로 전송
    ↓
ContributionList.tsx에서 상위 3명 표시 (MAX_DISPLAY_COUNT = 3, 코드 확인 완료)
```

### 문제점

**활동 횟수 vs 포인트 불일치**:

```typescript
// backend/src/github/progress.gateway.ts

// updateGlobalState() (line 263-268) - GitHub
contributionCount =
  rawData.commitCount +      // 횟수만 합산
  rawData.prCount + ...;

// addProgress() (line 222-223) - Task/Focus
this.globalState.contributions[username] += count;  // 횟수만 합산
```

| 활동 | contributions (현재) | 실제 포인트 |
|------|---------------------|------------|
| 커밋 1개 | +1 | +2 |
| PR 생성 1개 | +1 | +2 |
| PR 머지 1개 | +1 | +4 |
| PR 리뷰 1개 | +1 | +4 |
| 이슈 생성 1개 | +1 | +1 |
| Task 완료 1개 | +1 | +1 |
| Focus 30분 1회 | +1 | +1 |

**예시**:
- 사용자 A: 커밋 10개 → contributions: 10, 포인트: 20
- 사용자 B: PR 머지 5개 → contributions: 5, 포인트: 20
- **현재**: A가 1등으로 표시 (불일치)
- **기대**: A와 B가 동점 처리

---

## 변경 계획

### 핵심 변경

contributions에 **활동 횟수** 대신 **포인트(progressIncrement)**를 누적

### 1. ProgressGateway.updateGlobalState() 수정

**Before (line 248-273)**:
```typescript
private updateGlobalState(...) {
  let progressIncrement = 0;
  let contributionCount = 0;  // 삭제

  if (source === ProgressSource.GITHUB) {
    progressIncrement =
      rawData.commitCount * ACTIVITY_POINT_MAP[PointType.COMMITTED] + ...;
    contributionCount =
      rawData.commitCount + rawData.prCount + ...;  // 삭제
  }

  this.globalState.contributions[username] += contributionCount;
}
```

**After**:
```typescript
private updateGlobalState(...) {
  let progressIncrement = 0;

  if (source === ProgressSource.GITHUB) {
    // GitHub: 타입별 포인트 합산
    progressIncrement =
      rawData.commitCount * ACTIVITY_POINT_MAP[PointType.COMMITTED] +
      rawData.prCount * ACTIVITY_POINT_MAP[PointType.PR_OPEN] +
      rawData.mergeCount * ACTIVITY_POINT_MAP[PointType.PR_MERGED] +
      rawData.issueCount * ACTIVITY_POINT_MAP[PointType.ISSUE_OPEN] +
      rawData.reviewCount * ACTIVITY_POINT_MAP[PointType.PR_REVIEWED];
  }

  // contributions에 포인트(progressIncrement)를 누적
  this.globalState.contributions[username] =
    (this.globalState.contributions[username] || 0) + progressIncrement;
}
```

> `contributionCount` 변수 완전 제거. progress와 contributions 모두 `progressIncrement` 사용.
>
> **Note**: 기존 progress 업데이트 로직(`this.globalState.progress += progressIncrement`)과 맵 전환 로직은 변경 없음. contributions 누적 로직만 수정.

### 2. ProgressGateway.addProgress() 수정

**Before (line 210-223)**:
```typescript
public addProgress(username: string, source: ProgressSource, count: number) {
  let progressIncrement = 0;

  if (source === ProgressSource.TASK) {
    progressIncrement = count * ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED];
  } else if (source === ProgressSource.FOCUSTIME) {
    progressIncrement = count * ACTIVITY_POINT_MAP[PointType.FOCUSED];
  }

  if (progressIncrement === 0) return;

  this.globalState.progress += progressIncrement;
  this.globalState.contributions[username] =
    (this.globalState.contributions[username] || 0) + count;  // ← 횟수!

  // ... schedulePersist(), server.emit() 등
}
```

**After (line 223만 변경)**:
```typescript
public addProgress(username: string, source: ProgressSource, count: number) {
  // ... 동일 ...

  // contributions에 포인트(progressIncrement)를 누적 (count → progressIncrement)
  this.globalState.contributions[username] =
    (this.globalState.contributions[username] || 0) + progressIncrement;

  // ... schedulePersist(), server.emit() 등 변경 없음
}
```

> **변경 범위**: line 223의 `count` → `progressIncrement`만 변경. 나머지 로직 동일.

### 3. 시퀀스 다이어그램 (변경 후)

```
GitHub 활동 감지 / Task 완료 / Focus 30분
    ↓
ProgressGateway.updateGlobalState() 또는 addProgress()
    ↓
progressIncrement = 타입별 포인트 합산 (ACTIVITY_POINT_MAP 참조)
  - GitHub: 각 활동 타입별 포인트 × 횟수
  - Task/Focus: 각 타입별 포인트 × count
    ↓
contributions[username] += progressIncrement  ← 포인트 누적
    ↓
game_state / progress_update 이벤트로 전송
    ↓
ContributionList.tsx에서 상위 3명 (포인트 기준)
```

> **Note**: 포인트 값은 [POINT_SYSTEM.md](../features/POINT_SYSTEM.md)의 `ACTIVITY_POINT_MAP` 참조. 하드코딩 금지.
>
> **확인**: ContributionList.tsx의 `MAX_DISPLAY_COUNT = 3`으로 이미 상위 3명 표시. 코드 변경 불필요.

---

## 수정 대상 파일

### 백엔드

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/progress.gateway.ts` | updateGlobalState(), addProgress()에서 contributions에 progressIncrement 누적, 주석 "count" → "points" |

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/stores/useContributionStore.ts` | 주석 `{ username: count }` → `{ username: points }` |

### 문서

| 파일 | 변경 내용 |
|------|----------|
| `docs/api/SOCKET_EVENTS.md` | contributions 설명: "활동 횟수" → "포인트" |
| `docs/architecture/GAME_ENGINE.md` | "상위 5명" → "상위 3명", contributions 설명 수정, 오래된 참조 정리 (createContributionList.ts 삭제, useProgressStore → useContributionStore) |
| `docs/guides/DOMAIN_GLOSSARY.md` | "활동 수" → "포인트", "상위 5명" → "상위 3명" |
| `docs/api/GITHUB_POLLING.md` | "총 기여 수" → "포인트" |
| `docs/architecture/BACKEND_MODULES.md` | "count" → "points" |
| `docs/features/ROOM_JOIN_FLOW.md` | "count" → "points" |
| `docs/guides/ERD.md` | "count" → "points" |
| `docs/api/REST_ENDPOINTS.md` | 예시 업데이트 |

> **Note**: `docs/api/GITHUB_POLLING.md`는 이벤트 데이터 형태, 프로그레스 계산 등 코드와 불일치하는 부분이 더 있음. 전체 정리는 별도 이슈로 분리 권장.

---

## 마이그레이션

### 선택: 다음 시즌 리셋 대기

배포 시점에 별도 DB 작업 없이, 다음 시즌 리셋까지 대기.

**일정:**
- 다음 시즌 리셋: **2026-02-09 KST 월요일 00:00**
- 스케줄러가 `resetSeason()` 자동 호출 → contributions `{}`로 초기화

**배포 후 동작:**
- 기존 데이터(횟수)와 새 데이터(포인트)가 최대 7일간 혼재
- 시즌 리셋 후 포인트 기반으로 정상화

**배포 절차:**
```bash
# 일반 배포 (DB 작업 없음)
pm2 restart all
```

> **Note**: 시즌 리셋 전까지 순위 불일치 허용. 리셋 후 포인트 기반 정확한 순위 반영.

---

## 테스트 계획

### 단위 테스트

> **Note**: `updateGlobalState()`는 private 메서드이므로 `castProgressUpdate()`를 통해 테스트

> **Note**: `castProgressUpdate()`와 `addProgress()`는 내부에서 `schedulePersist()`(타이머)와 `server.emit()`(소켓)을 호출함. 테스트 시 **타이머 모킹**(jest.useFakeTimers)과 **server.emit 스텁** 필요.

1. **castProgressUpdate()**: GitHub 활동 시 contributions가 포인트로 누적
   - 커밋 1개 → contributions += ACTIVITY_POINT_MAP[COMMITTED]
   - PR 머지 1개 → contributions += ACTIVITY_POINT_MAP[PR_MERGED]
   - 커밋 2개 + PR 머지 1개 → contributions += (COMMITTED×2 + PR_MERGED×1)

2. **addProgress()**: Task/Focus 시 contributions가 포인트로 누적
   - Task 완료 1개 → contributions += ACTIVITY_POINT_MAP[TASK_COMPLETED]
   - Focus 30분 1회 → contributions += ACTIVITY_POINT_MAP[FOCUSED]
   - Task 완료 3개 → contributions += ACTIVITY_POINT_MAP[TASK_COMPLETED] × 3

> **Note**: 테스트에서 포인트 값은 `ACTIVITY_POINT_MAP`에서 가져와 검증. 하드코딩 금지.

### 통합 테스트

1. GitHub 커밋 감지 → contributions에 포인트 누적 확인 (ACTIVITY_POINT_MAP 기준)
2. PR 머지 감지 → contributions에 포인트 누적 확인
3. Task 완료 (정산 시점) → contributions에 포인트 누적 확인
4. Focus 30분 (정산 시점) → contributions에 포인트 누적 확인
5. 프론트엔드 ContributionList에 포인트 순 정렬 확인

### 이벤트 페이로드 테스트

1. **progress_update 이벤트**: contributions 필드가 포인트 기준 값 포함 확인
   - 커밋 1개 → payload.contributions["user"] === ACTIVITY_POINT_MAP[COMMITTED]
2. **game_state 이벤트**: 입장 시 contributions 필드가 포인트 기준 값 반환 확인

### 영속성/복원 테스트

1. **저장-복원 정합성**:
   - contributions에 포인트 누적 후 `persistState()` 호출
   - 새 ProgressGateway 인스턴스 생성 (onModuleInit)
   - 복원된 contributions 값이 포인트 기준인지 확인

2. **시즌 리셋 후 포인트 누적**:
   - `resetSeason()` 호출 → contributions `{}`
   - GitHub 커밋 1개 감지 → contributions["user"] === ACTIVITY_POINT_MAP[COMMITTED]
   - 복원 후에도 동일 값 유지

### 정합성 테스트

1. 프로그레스바 하단 순위와 리더보드 모달 순위 일치 확인
2. 동점자 처리 확인

### 수동 검증 (배포 후)

1. 서버 재시작 전후 contributions 값 비교 (로그 확인)
2. 리더보드와 ContributionList 순위 일치 확인

---

## 브랜치

```
refactor/#386-contributions-point
```

---

## 체크리스트

- [x] 현재 contributions 데이터 흐름 분석
- [x] 이슈 수정
- [x] `ProgressGateway.updateGlobalState()` 수정
- [x] `ProgressGateway.addProgress()` 수정
- [x] 코드 내 주석 업데이트
  - [x] `backend/src/github/progress.gateway.ts` - "count" → "points"
  - [x] `frontend/src/stores/useContributionStore.ts` - "count" → "points"
- [x] 테스트 작성
  - [x] castProgressUpdate: GitHub 활동 시 contributions 포인트 누적
  - [x] addProgress: Task/Focus 시 contributions 포인트 누적
  - [x] 영속성/복원: 저장-복원 정합성
  - [x] 시즌 리셋 후 포인트 누적
  - [x] 이벤트 페이로드: progress_update, game_state에 포인트 기준 contributions 포함
- [ ] 문서 업데이트
  - [ ] `docs/api/SOCKET_EVENTS.md`
  - [ ] `docs/architecture/GAME_ENGINE.md` (오래된 참조 정리 포함)
  - [ ] `docs/guides/DOMAIN_GLOSSARY.md`
  - [ ] `docs/api/GITHUB_POLLING.md`
  - [ ] `docs/architecture/BACKEND_MODULES.md`
  - [ ] `docs/features/ROOM_JOIN_FLOW.md`
  - [ ] `docs/guides/ERD.md`
  - [ ] `docs/api/REST_ENDPOINTS.md`
- [ ] 배포 (일반 배포, DB 작업 없음)
- [ ] 시즌 리셋 후 검증 (2/9 이후 리더보드/ContributionList 순위 일치 확인)
- [ ] (별도 이슈) `docs/api/GITHUB_POLLING.md` 전체 정리
