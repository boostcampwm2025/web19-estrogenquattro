# Issue #358: 리더보드 탭 전환 시 화면 번쩍임 현상

## 문제 분석

### 현상

리더보드 모달에서 탭(전체/커밋/PR생성/PR머지/이슈/리뷰/집중)을 전환할 때 화면이 잠깐 사라졌다가 다시 나타나는 번쩍임 현상 발생

### 원인

```
탭 클릭 → selectedTab 변경 → queryKey 변경 → 새 API 호출
                                              ↓
                                         isLoading = true
                                              ↓
                                    leaderboardData = null (60-61줄)
                                              ↓
                                      모달 전체 return null (104줄)
                                              ↓
                                         화면 사라짐
                                              ↓
                                    데이터 도착 → 다시 렌더링
                                              ↓
                                          번쩍임!
```

**문제 코드:**

```tsx
// LeaderboardModal.tsx:60-61
const leaderboardData = useMemo<LeaderboardResponse | null>(() => {
  if (!isOpen || isLoading) return null;  // ← 로딩 중에 null 반환
  ...
});

// LeaderboardModal.tsx:104
if (!isOpen || !leaderboardData) return null;  // ← 모달 전체 미렌더링
```

---

## 해결 방안

### 선택: 로컬 상태로 변환된 데이터 캐시

#### ❌ `keepPreviousData` 사용 불가 이유

TanStack Query의 `placeholderData: keepPreviousData`는 **이전 queryKey의 raw 데이터**를 유지합니다.
하지만 이 프로젝트에서는 탭별로 응답 타입이 다릅니다:

```tsx
TotalRankRes {        // ALL 탭
  totalPoints: number;
}

ActivityRankRes {     // 활동 탭 (커밋, PR 등)
  count: number;      // ← 다른 필드!
}
```

`keepPreviousData` 사용 시 문제:
```
ALL 탭 → 커밋 탭 전환
  ↓
placeholder = TotalRankRes[] (totalPoints 있음)
  ↓
selectedTab = COMMITTED → toLeaderboardPlayerFromActivity() 호출
  ↓
ActivityRankRes.count 접근 → undefined! (데이터 형태 불일치)
```

#### ✅ 해결책: useState + useEffect로 변환된 데이터 캐시

**핵심 아이디어:** 변환 후의 `LeaderboardResponse`를 캐시하면 형태 불일치 문제 없음

```tsx
// LeaderboardModal.tsx

// 1. API 호출 (기존과 동일)
const { ranks, isLoading } = useLeaderboard(weekendStartAt, selectedTab, isOpen);

// 2. useState로 캐시 (새로 추가)
const [cachedData, setCachedData] = useState<LeaderboardResponse | null>(null);

// 3. useEffect로 데이터 도착 시에만 업데이트
useEffect(() => {
  if (!isOpen) return;
  if (isLoading) return;              // 로딩 중이면 업데이트 안 함 (기존 캐시 유지)
  if (!ranks) return;                 // undefined/null만 체크 (빈 배열은 유효 데이터)

  const isAll = selectedTab === POINT_TYPES.ALL;
  const newData: LeaderboardResponse = {
    seasonEndTime: getNextMonday(),
    players: isAll
      ? (ranks as TotalRankRes[]).map(toLeaderboardPlayerFromTotal)
      : (ranks as ActivityRankRes[]).map(toLeaderboardPlayerFromActivity),
    myRank: isAll
      ? toMyRankPlayerFromTotal(ranks as TotalRankRes[], user?.playerId, user?.username)
      : toMyRankPlayerFromActivity(ranks as ActivityRankRes[], user?.playerId, user?.username),
  };
  setCachedData(newData);
}, [isOpen, isLoading, ranks, user, selectedTab]);

// 4. 모달 닫을 때 캐시 초기화
useEffect(() => {
  if (!isOpen) {
    setCachedData(null);
  }
}, [isOpen]);

// 5. cachedData 사용 (isLoading과 무관하게 유지)
if (!isOpen || !cachedData) return null;
```

**동작 흐름:**

| 상황 | isLoading | cachedData | 결과 |
|------|-----------|------------|------|
| 초기 로딩 | true | null | `return null` (정상) |
| 데이터 도착 | false | 업데이트 | UI 표시 |
| 탭 전환 중 | true | 이전 데이터 유지 | **깜박임 없음** |
| 새 데이터 도착 | false | 업데이트 | 자연스럽게 교체 |
| 모달 닫기 | - | null로 초기화 | 다음 열 때 깨끗한 상태 |

**장점:**

- 탭 전환 시 이전 데이터가 유지되어 번쩍임 없음
- 새 데이터가 도착하면 자연스럽게 교체
- 데이터 형태 불일치 문제 없음 (변환 후 캐시)
- 모달 닫을 때 캐시 초기화로 stale 데이터 방지
- 빈 배열도 유효 데이터로 처리 (0명 랭킹 정상 표시)

**스코프 외 (의도적 생략):**

- 탭 전환 중 "업데이트 중" 배지/인디케이터 UI
  - 현재 목표: 깜박임 방지
  - 추후 UX 개선 시 `isLoading` 상태로 배지 표시 가능

---

## 구현 계획

### 1단계: useLeaderboard 훅 (변경 없음)

**파일:** `frontend/src/lib/api/hooks/useLeaderboard.ts`

- 기존 코드 유지 (수정 불필요)

### 2단계: LeaderboardModal 수정

**파일:** `frontend/src/app/_components/LeaderboardModal/LeaderboardModal.tsx`

**2-1. useState 추가**

```tsx
// Before: 없음

// After: cachedData 상태 추가
const [cachedData, setCachedData] = useState<LeaderboardResponse | null>(null);
```

**2-2. useMemo → useEffect로 변경 (60-82줄)**

```tsx
// Before: useMemo
const leaderboardData = useMemo<LeaderboardResponse | null>(() => {
  if (!isOpen || isLoading) return null;
  const isAll = selectedTab === POINT_TYPES.ALL;
  return {
    seasonEndTime: getNextMonday(),
    players: isAll ? ... : ...,
    myRank: isAll ? ... : ...,
  };
}, [isOpen, isLoading, ranks, user, selectedTab]);

// After: useEffect
useEffect(() => {
  if (!isOpen) return;
  if (isLoading) return;
  if (!ranks) return;                 // undefined/null만 체크 (빈 배열은 유효 데이터)

  const isAll = selectedTab === POINT_TYPES.ALL;
  const newData: LeaderboardResponse = {
    seasonEndTime: getNextMonday(),
    players: isAll
      ? (ranks as TotalRankRes[]).map(toLeaderboardPlayerFromTotal)
      : (ranks as ActivityRankRes[]).map(toLeaderboardPlayerFromActivity),
    myRank: isAll
      ? toMyRankPlayerFromTotal(ranks as TotalRankRes[], user?.playerId, user?.username)
      : toMyRankPlayerFromActivity(ranks as ActivityRankRes[], user?.playerId, user?.username),
  };
  setCachedData(newData);
}, [isOpen, isLoading, ranks, user, selectedTab]);
```

**2-3. 모달 닫을 때 캐시 초기화 추가**

```tsx
useEffect(() => {
  if (!isOpen) {
    setCachedData(null);
  }
}, [isOpen]);
```

**2-4. 렌더링 조건 수정 (104줄)**

```tsx
// Before
if (!isOpen || !leaderboardData) return null;

// After
if (!isOpen || !cachedData) return null;
```

**2-5. leaderboardData → cachedData로 참조 변경**

- `seasonTime` useMemo의 의존성
- 시즌 타이머 useEffect의 조건
- JSX 내 `leaderboardData.players`, `leaderboardData.myRank` 등

### 3단계: 테스트

#### 사전 조건

- 개발 서버 실행 (`pnpm dev` 또는 `pnpm start:dev`)
- 로그인된 상태

#### 테스트 1: 탭 전환 시 깜박임 확인

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 리더보드 모달 열기 | 전체 탭 데이터 표시 |
| 2 | "커밋" 탭 클릭 | ❌ 화면 사라짐 없음 / ✅ 이전 데이터 유지 → 새 데이터로 교체 |
| 3 | "PR생성" 탭 클릭 | ❌ 화면 사라짐 없음 / ✅ 부드러운 전환 |
| 4 | 빠르게 탭 여러 번 클릭 | ❌ 깜박임 없음 / ✅ 마지막 탭 데이터 표시 |

#### 테스트 2: 네트워크 지연 시뮬레이션

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 개발자 도구 → Network → Slow 3G 설정 | |
| 2 | 리더보드 모달 열기 | 로딩 후 데이터 표시 |
| 3 | 다른 탭 클릭 | ✅ 이전 탭 데이터가 계속 보임 (2-3초간) |
| 4 | 새 데이터 도착 | ✅ 자연스럽게 교체 (깜박임 없음) |

> 네트워크 지연이 있을 때 효과가 더 명확하게 보임

#### 테스트 3: 초기 로딩 동작 확인

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 페이지 새로고침 | |
| 2 | 리더보드 모달 열기 | ✅ 초기 로딩 시에는 빈 화면 또는 로딩 상태 (정상) |
| 3 | 데이터 도착 후 탭 전환 | ✅ 깜박임 없이 전환 |

#### 테스트 4: 모달 닫았다 열기 (캐시 초기화 확인)

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 리더보드 모달 열기 → 커밋 탭 선택 | 커밋 탭 데이터 표시 |
| 2 | 모달 닫기 | |
| 3 | 모달 다시 열기 | ✅ 전체 탭(기본값)으로 초기화, 이전 커밋 탭 데이터 잔존 안 함 |
| 4 | 탭 전환 | ✅ 깜박임 없음 |

#### 확인 포인트 요약

| 항목 | Before (버그) | After (수정 후) |
|------|--------------|-----------------|
| 탭 전환 시 | 화면 사라짐 → 다시 나타남 | 이전 데이터 유지 → 새 데이터로 교체 |
| 느린 네트워크 | 빈 화면 오래 표시 | 이전 데이터 계속 표시 |
| 빠른 탭 클릭 | 깜박임 반복 | 부드러운 전환 |

---

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/lib/api/hooks/useLeaderboard.ts` | 변경 없음 |
| `frontend/src/app/_components/LeaderboardModal/LeaderboardModal.tsx` | `useMemo` → `useState` + `useEffect`로 변경, 캐시 초기화 로직 추가 |

---

## 기술적 결정 근거

### `keepPreviousData` 사용하지 않는 이유

TanStack Query의 `placeholderData: keepPreviousData`는 페이지네이션에 적합하지만,
이 프로젝트에서는 **탭별로 응답 타입이 다르므로** 사용할 수 없습니다.

| 탭 | 응답 타입 | 주요 필드 |
|----|----------|----------|
| ALL | `TotalRankRes[]` | `totalPoints` |
| 커밋, PR 등 | `ActivityRankRes[]` | `count` |

`keepPreviousData`는 raw 데이터(ranks)를 유지하므로, 탭 전환 시 잘못된 타입으로 처리되어 `undefined` 발생.

### 로컬 상태 캐시 선택 이유

- **변환 후 데이터 캐시**: `LeaderboardResponse` 타입으로 통일되어 형태 불일치 없음
- **React 표준 패턴**: `useState` + `useEffect`는 일반적인 React 패턴
- **명확한 제어**: 캐시 초기화 시점을 명시적으로 제어 가능

### Vercel React Best Practices 검증

구현된 코드가 [Vercel React Best Practices](https://github.com/vercel/react-best-practices) 기준을 준수하는지 검증했습니다.

#### ✅ 준수 항목

| 규칙 | 상태 | 설명 |
|------|------|------|
| `rerender-defer-reads` | ✅ | 상태 업데이트 로직이 콜백 내에서만 사용됨 |
| `rerender-memo` | ✅ | `seasonTime` useMemo 유지로 매 tick마다 불필요한 재계산 방지 |
| `rerender-functional-setstate` | ✅ | `setTick((t) => t + 1)` 함수형 setState로 안정적인 콜백 |
| `js-early-exit` | ✅ | useEffect 내 early return 패턴 적용 |

#### 💡 패턴 선택 근거

- **`useMemo` vs `useState` + `useEffect`**: 이 경우 데이터가 "도착했을 때만" 업데이트해야 하므로 의도적인 상태 캐싱이 필요. `useMemo`는 의존성 변경 시 즉시 재계산되어 로딩 중 null 반환 문제 해결 불가.
- **불필요한 리렌더링 방지**: 로딩 중에 null을 반환하지 않고 이전 데이터를 유지하여 컴포넌트 언마운트/리마운트 방지
- **Effect 의존성 배열**: 모든 의존성이 올바르게 포함됨

#### ⚠️ 고려했으나 미적용

| 규칙 | 이유 |
|------|------|
| `rerender-transitions` | 탭 전환 시 `startTransition` 사용 가능하나, 현재 캐시 방식으로 깜박임이 충분히 해결되어 불필요 |

---

## 참고

- [TanStack Query - Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data) - `keepPreviousData` 동작 방식
- [TanStack Query - Paginated/Lagged Queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries) - 동일 타입 페이지네이션에 적합
- [GitHub Discussion #6460](https://github.com/TanStack/query/discussions/6460) - keepPreviousData deprecated 논의
