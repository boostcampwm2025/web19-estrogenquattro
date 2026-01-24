# Stacked PR 머지 계획

**최종 업데이트:** 2026-01-22

---

## PR 현황

### 의존성 구조

```
main (6b89832)
├── PR #168 (fix/#126-focustime-seconds) ← 머지 완료 ✅
│   └── PR #170 (fix/#164-task-focustime) ← 머지 완료 ✅
│       └── PR #176 (fix/#166-socket-response) ← Rebase 완료, 머지 대기
│
└── PR #177 (feat/#159-heartbeat) ← 독립 PR, 순서 무관
```

### PR 상세

| PR | 브랜치 | 제목 | Base | 상태 |
|----|--------|------|------|------|
| #168 | fix/#126-focustime-seconds | fix: 집중 시간 저장 단위를 분에서 초로 변경 | main | ✅ 머지 완료 |
| #170 | fix/#164-task-focustime | fix: 개별 태스크 집중 시간이 서버에 저장되지 않는 문제 수정 | main | ✅ 머지 완료 |
| #176 | fix/#166-socket-response | fix: 소켓 이벤트 클라이언트 응답 추가 | main | Rebase 완료, 머지 대기 |
| #177 | feat/#159-heartbeat | feat: 소켓 연결 끊김 감지 및 재연결 UI 피드백 추가 | main | 독립 |

---

## 머지 순서

### 1단계: PR #168 머지 ✅ (완료)

**브랜치:** `fix/#126-focustime-seconds`

**완료된 작업:**
- [x] main 기준 rebase 완료
- [x] 충돌 해결 (SocketManager.ts, api/client.ts)
- [x] 추가 수정 (api/task.ts, focustime.controller.ts, focustime.service.ts)
- [x] CI 통과 (Backend 53 tests, Frontend 26 tests)
- [x] Squash merge to main

**충돌 해결 내역:**

| 파일 | 해결 방법 |
|------|----------|
| `frontend/src/lib/api/client.ts` | HEAD 선택 (TaskRes는 task.ts에 있음) |
| `frontend/src/game/managers/SocketManager.ts` | 양쪽 변경 모두 반영 |
| `frontend/src/lib/api/task.ts` | `totalFocusSeconds` 추가 적용 |
| `backend/src/focustime/focustime.controller.ts` | `totalFocusSeconds` 추가 적용 |
| `backend/src/focustime/focustime.service.ts` | `totalFocusSeconds` 추가 적용 |
| `frontend/.../ProfileTab.tsx` | `githubEvents ?? null` 타입 수정 |

---

### 2단계: PR #170 머지 ✅ (완료)

**브랜치:** `fix/#164-task-focustime`

**선행 조건:** PR #168 머지 완료 ✅

**완료된 작업:** Rebase, CI 통과, Squash merge to main

#### 충돌 파일 목록

| 파일 | 현재 브랜치 (#164) | main (#168 머지) |
|------|-------------------|------------------|
| `migrations/1768996643748-*.ts` | seconds 마이그레이션 | 동일 |
| `focustime.service.ts` | taskId 처리, 트랜잭션, addFocusTimeToTask | totalFocusSeconds, getFocusTime null 반환 |
| `focustime.service.spec.ts` | taskId 관련 테스트 | totalFocusSeconds 테스트 |
| `FOCUSTIME_BUGS.md` | #164 완료 표시 | #126 완료 표시 |
| `TasksMenu.tsx` | taskId를 startFocusing에 전달 | UI/UX 변경 |
| `SocketManager.ts` | totalFocusSeconds | FocusStatus 타입, FOCUS_STATUS 상수, playerId |
| `api.ts` | totalFocusSeconds | **파일 삭제** (api/로 분리) |

#### 해결 원칙

**main의 기존 동작 유지 + 초 단위/태스크 기능 추가**

#### 파일별 해결 방법

| 파일 | 해결 방법 |
|------|----------|
| `migrations/*.ts` | main 것 유지 (currentTaskId는 별도 마이그레이션으로 분리됨) |
| `focustime.service.ts` | main 로직 유지 + taskId/트랜잭션/addFocusTimeToTask 합치기 |
| `focustime.service.spec.ts` | main 테스트 보존 + taskId 케이스 추가, totalFocusSeconds 통일 |
| `FOCUSTIME_BUGS.md` | 양쪽 변경 모두 유지 (union) |
| `TasksMenu.tsx` | main UI 유지 + `startFocusing(desc, taskId)` 반영 |
| `SocketManager.ts` | main 이벤트 로직 유지 + `totalFocusSeconds ?? 0` (fallback 없이) |
| `api.ts` | **삭제** (`api/task.ts`에 이미 적용됨), import 경로 변경 |

#### 체크리스트

- [x] rebase 실행
- [x] 충돌 해결
- [x] CI 통과 (Backend 57 tests, Frontend 26 tests)
- [x] Squash merge to main

---

### 3단계: PR #176 머지 (Rebase 완료, 머지 대기)

**브랜치:** `fix/#166-socket-response`

**선행 조건:** PR #170 머지 완료 ✅

**현재 상태:** Rebase 완료, CI 통과, Force push 완료 → Squash merge 대기 중

#### 해결하는 이슈

- **#166**: 소켓 이벤트 클라이언트 응답 (try-catch + return ack)

#### Skip된 커밋 (PR #168, #170 - 이미 main에 머지됨)

| 커밋 | 내용 | 소속 PR |
|------|------|---------|
| `ccdae2d` | fix: 집중 시간 저장 단위를 분에서 초로 변경 | #168 |
| `d8462c2` | docs: #126 해결 완료 상태 업데이트 | #168 |
| `09c4558` | fix: 개별 태스크 집중 시간이 서버에 저장되지 않는 문제 수정 | #170 |
| `7586844` | test: Task 집중 시간 저장 기능 테스트 추가 | #170 (auto drop) |
| `ba3d94a` | docs: #164 해결 완료 상태 업데이트 | #170 |
| `0f916c5` | fix: Task 소유권 검증 및 태스크 전환 시 집중 시간 누락 수정 | #170 |
| `881819a` | docs: #165 스킵 결정 및 이슈 닫힘 기록 | #170 (auto drop) |

#### 충돌 해결된 PR #176 고유 커밋

| 커밋 | 파일 | 해결 방법 |
|------|------|----------|
| `8d776bc` | FOCUSTIME_BUGS.md | 양쪽 병합 (#167 스킵, #159, #181 추가) |
| `0893107` | focustime.service.ts | main 유지 (이미 트랜잭션 있음) |
| `fc1f804` | useFocusTimeStore.ts | FOCUS_STATUS 상수 + prev 기반 rollback 병합 |
| `c4b9fd2` | FOCUSTIME_BUGS.md | 양쪽 병합 (#181, #182 추가) |

#### 핵심 파일 상세

**1. focustime.gateway.ts** - #166 핵심 수정

```typescript
// main에 없고 브랜치에 있는 패턴 (추가 필요):
try {
  const focusTime = await this.focusTimeService.startFocusing(user.playerId, data?.taskId);
  // ... 기존 로직 ...
  return { success: true, data: responseData };  // 본인에게 응답
} catch (error) {
  return { success: false, error: message };
}
```

**2. useFocusTimeStore.ts** - FOCUS_STATUS + rollback

```typescript
// main의 FOCUS_STATUS 상수 유지:
export const FOCUS_STATUS = {
  FOCUSING: "FOCUSING",
  RESTING: "RESTING",
} as const;

// 브랜치의 rollback 로직 추가:
startFocusing: (taskName?, taskId?) => {
  const prev = get();
  if (prev.status === FOCUS_STATUS.FOCUSING) return;
  set({ status: FOCUS_STATUS.FOCUSING, ... });  // 낙관적 업데이트
  socket.emit("focusing", { taskName, taskId }, (response) => {
    if (!response?.success) {
      set({ status: FOCUS_STATUS.RESTING, error: ... });  // rollback
    }
  });
},
```

**3. TasksMenu.tsx** - #124 타이머 정확도 (중요!)

```typescript
// main: incrementFocusTime() 사용 → 탭 비활성화 시 부정확
// 브랜치: focusStartTimestamp 기반 → 정확

// 반드시 브랜치 로직 유지:
useEffect(() => {
  if (isTimerRunning) {
    interval = window.setInterval(() => {
      const { focusStartTimestamp, baseFocusSeconds } = useFocusTimeStore.getState();
      if (focusStartTimestamp) {
        const elapsed = Math.floor((Date.now() - focusStartTimestamp) / 1000);
        setFocusTime(baseFocusSeconds + elapsed);
      }
    }, 1000);
  }
}, [isTimerRunning, setFocusTime]);
```

#### 체크리스트

- [x] #170 머지 후 GitHub가 자동으로 base를 main으로 변경
- [x] rebase 실행 (PR #168, #170 커밋 7개 skip)
- [x] 충돌 해결 (PR #176 고유 커밋 4개)
- [x] CI 실행 (Backend 57 tests, Frontend 31 tests)
- [x] Force push
- [ ] Squash merge to main

#### 관련 코멘트

- [PR #176 충돌 해결 계획](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/176#issuecomment-3782857339)

---

### 4단계: PR #177 머지 (독립)

**브랜치:** `feat/#159-heartbeat`

**선행 조건:** 없음 (main 기준, 독립적)

**예상 작업:**
- [ ] 충돌 확인 (main 변경으로 인한)
- [ ] CI 실행 (`/ci`)
- [ ] Squash merge to main

---

## Stacked PR 머지 시 주의사항

### GitHub 자동 base 변경

Stacked PR의 base branch가 머지되면 GitHub가 자동으로 다음 PR의 base를 main으로 변경합니다.

```
머지 전:
#168 (base: main) ← #170 (base: #168) ← #176 (base: #170)

#168 머지 후:
main ← #170 (base: main으로 자동 변경) ← #176 (base: #170)

#170 머지 후:
main ← #176 (base: main으로 자동 변경)
```

### Stacked PR Rebase 시 커밋 Skip

Stacked PR을 rebase할 때, base branch의 커밋들이 이미 main에 머지되어 있으면 충돌이 발생합니다.

```bash
# 예: PR #170 rebase 시 PR #168 커밋에서 충돌
error: could not apply ccdae2d... fix: 집중 시간 저장 단위를 분에서 초로 변경
```

**해결 방법:** 이미 main에 있는 커밋은 `git rebase --skip`으로 건너뜁니다.

```bash
git rebase --skip  # PR #168 커밋들은 이미 main에 있으므로 skip
```

PR #170의 경우:
- Skip 대상: PR #168의 커밋들 (이미 main에 머지됨)
- 충돌 해결 대상: PR #170 고유의 커밋들 (`e2ace45`, `a6a71ac` 등)

**PR #170 Rebase 결과 (2026-01-22):**

| 원본 커밋 | 처리 | 이유 |
|----------|------|------|
| `ccdae2d` fix: 집중 시간 저장 단위를 분에서 초로 변경 | **skip** | PR #168에서 이미 main에 머지됨 |
| `d8462c2` docs: #126 해결 완료 상태 업데이트 | **drop** | patch contents already upstream |
| `09c4558` fix: 개별 태스크 집중 시간이 서버에 저장되지 않는 문제 수정 | **충돌 해결** | focustime.service.spec.ts, TasksMenu.tsx |
| 나머지 9개 커밋 | **자동 적용** | 충돌 없음 |

**충돌 해결 내역:**

| 파일 | 해결 방법 |
|------|----------|
| `focustime.service.spec.ts` | 양쪽 import 모두 유지 (UserPet, Pet, Task), entities 배열에 모두 추가 |
| `TasksMenu.tsx` | main UI 유지 + `startFocusing(desc, taskId)` 반영 |

---

### 충돌 발생 시

각 PR 머지 후 다음 PR에서 충돌이 발생할 수 있습니다:

```bash
# 해당 브랜치로 이동
git checkout <branch>

# main과 차이 확인 (충돌 예상 지점)
git diff origin/main...HEAD -- <file>
git diff HEAD...origin/main -- <file>

# rebase
git fetch origin
git rebase origin/main

# 충돌 해결 후
git add .
git rebase --continue

# force push
git push --force-with-lease
```

### CI 실행 필수

각 PR 머지 전 반드시 CI 확인:

```bash
/ci
```

---

## 관련 문서

- [FocusTime 버그 계획](./20260121_1302_FOCUSTIME_BUGS.md) - #126, #164, #166 등 이슈 상세
- [PR #168 충돌 해결 코멘트](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/168#issuecomment-3782647887)
- [PR #170 충돌 해결 코멘트](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/170#issuecomment-3782715713)
