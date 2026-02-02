# Issue #336: 집중시간 순위 조회 리팩토링

## 이슈 요약

**제목**: refactor : 집중시간 순위 PointHistory에서 조회하지않고 FocusTime에서 조회하도록 변경

**브랜치**: `refactor/#336-focustime-rank`

---

## 참조한 문서

- [FOCUS_TIME.md](../features/FOCUS_TIME.md): FocusTime 데이터 모델 및 로직
- [POINT_SYSTEM.md](../features/POINT_SYSTEM.md): 포인트 시스템 구조 이해
- [ERD.md](../guides/ERD.md): 테이블 스키마 확인

---

## 현재 구조 (문제점)

### 현재 집중시간 순위 조회 로직

**endpoint**: `GET /api/history-ranks?type=FOCUSED&weekendStartAt=...`

**파일**: `backend/src/pointhistory/point-history.service.ts:69-112`

```typescript
async getHistoryRanks(type: PointType, weekendStartAt: Date): Promise<HistoryRank[]> {
  const results = await this.pointHistoryRepository
    .createQueryBuilder('ph')
    .select('ph.player_id', 'playerId')
    .addSelect('player.nickname', 'nickname')
    .addSelect('COUNT(*)', 'count')  // ← 레코드 개수로 순위 결정
    ...
```

### 문제점

1. **부정확한 순위 계산**: `PointHistory`에서 `type=FOCUSED` 레코드의 **개수(COUNT)**로 순위를 매김
   - 실제 집중 시간(초/분)이 아닌 포인트 적립 **횟수**로 순위가 결정됨
   - 예: 30분 집중 시 +1 포인트가 적립되므로, 60분 집중한 사람이나 30분 집중한 사람이나 각각 2개, 1개의 레코드
   - 세밀한 집중 시간 차이가 반영되지 않음

2. **데이터 중복**: `DailyFocusTime.totalFocusSeconds`에 이미 정확한 집중 시간이 저장되어 있음

### 관련 테이블

| 테이블 | 필드 | 설명 |
|--------|------|------|
| `daily_focus_time` | `total_focus_seconds` | 일별 누적 집중 시간 (초 단위) ✅ 정확함 |
| `point_history` | `type=FOCUSED`, `COUNT(*)` | 포인트 적립 레코드 개수 ❌ 부정확함 |

### 기간 조회 기준

- **컬럼**: `daily_focus_time.created_at` (datetime 타입)
- **타임존**: KST 기준 (프론트엔드에서 KST 월요일 00:00을 UTC로 변환하여 전달)
- **일 경계**: `created_at`이 datetime이므로 범위 쿼리 (`>= startAt AND < endAt`)로 처리

> **Note:** `DailyFocusTime` 테이블은 일별 레코드이지만, `created_at`이 datetime 타입이므로 시간까지 저장됨. 향후 `created_date` (YYYY-MM-DD 문자열) 컬럼으로 변경 검토 가능.

---

## 문제 재현 방법

### 사전 조건

1. 백엔드 개발 서버 실행: `cd backend && pnpm start:dev`
2. 테스트용 플레이어 2명 이상 로그인

### 재현 시나리오

**시나리오: 세밀한 집중 시간 차이가 순위에 반영되지 않음**

1. **데이터 준비** (SQLite DB 직접 조회)

```bash
# SQLite CLI 접속
sqlite3 backend/database.sqlite

# 현재 DailyFocusTime 데이터 확인
SELECT p.nickname, ft.total_focus_seconds, ft.created_at
FROM daily_focus_time ft
JOIN players p ON ft.player_id = p.id
WHERE ft.created_at >= date('now', '-7 days')
ORDER BY ft.total_focus_seconds DESC;
```

2. **현재 API 응답 확인**

```bash
# 이번 주 월요일 00:00 KST를 UTC로 변환하여 요청
# 예: 2026-01-26(월) KST 00:00 = 2026-01-25T15:00:00.000Z (UTC)
curl "http://localhost:8080/api/history-ranks?type=FOCUSED&weekendStartAt=2026-01-25T15:00:00.000Z"
```

3. **문제 확인**

```bash
# PointHistory에서 FOCUSED 레코드 확인
SELECT p.nickname, COUNT(*) as record_count
FROM point_history ph
JOIN players p ON ph.player_id = p.id
WHERE ph.type = 'FOCUSED'
  AND ph.created_at >= '2026-01-25T15:00:00.000Z'
GROUP BY ph.player_id
ORDER BY record_count DESC;

# DailyFocusTime에서 실제 집중 시간 확인
SELECT p.nickname, SUM(ft.total_focus_seconds) as total_seconds
FROM daily_focus_time ft
JOIN players p ON ft.player_id = p.id
WHERE ft.created_at >= '2026-01-25T15:00:00.000Z'
GROUP BY ft.player_id
ORDER BY total_seconds DESC;
```

**예상 결과 (문제 상황):**

| 플레이어 | PointHistory COUNT | DailyFocusTime SUM | 현재 순위 | 올바른 순위 |
|---------|-------------------|-------------------|----------|------------|
| alice | 3 | 5490초 (1시간 31분 30초) | 1등 | 1등 |
| bob | 3 | 5400초 (1시간 30분) | 1등 (동점) | 2등 |

→ alice가 90초 더 집중했지만 현재 로직에서는 동점 처리됨

### 자동화된 재현 스크립트

```bash
#!/bin/bash
# scripts/reproduce-issue-336.sh

echo "=== Issue #336 재현: 집중시간 순위 부정확 ==="

# 1. DailyFocusTime 실제 데이터
echo -e "\n[1] DailyFocusTime 실제 집중 시간 (초 단위):"
sqlite3 backend/database.sqlite "
SELECT p.nickname, SUM(ft.total_focus_seconds) as total_seconds
FROM daily_focus_time ft
JOIN players p ON ft.player_id = p.id
WHERE ft.created_at >= datetime('now', '-7 days')
GROUP BY ft.player_id
ORDER BY total_seconds DESC
LIMIT 10;
"

# 2. PointHistory 레코드 개수
echo -e "\n[2] PointHistory FOCUSED 레코드 개수 (현재 순위 기준):"
sqlite3 backend/database.sqlite "
SELECT p.nickname, COUNT(*) as record_count
FROM point_history ph
JOIN players p ON ph.player_id = p.id
WHERE ph.type = 'FOCUSED'
  AND ph.created_at >= datetime('now', '-7 days')
GROUP BY ph.player_id
ORDER BY record_count DESC
LIMIT 10;
"

# 3. API 응답 비교
echo -e "\n[3] 현재 API 응답:"
WEEK_START=$(date -d "last monday" -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -v-monday -u +"%Y-%m-%dT%H:%M:%S.000Z")
curl -s "http://localhost:8080/api/history-ranks?type=FOCUSED&weekendStartAt=$WEEK_START" | jq .

echo -e "\n=== 불일치 여부 확인 필요 ==="
```

---

## 대안 방식 검토

### 검토한 방법들

| 방법 | 설명 | 장점 | 단점 | 결론 |
|------|------|------|------|------|
| **A. SUM(totalFocusSeconds)** | DailyFocusTime에서 직접 조회 | 정확한 초 단위, 기존 데이터 활용, 마이그레이션 불필요 | count 필드 의미 변경, 프론트엔드 포맷팅 필요 | ✅ **채택** |
| **B. SUM(amount) from PointHistory** | PointHistory.amount 합산 | API 구조 변경 없음 | 30분 단위 정밀도 한계 동일 (문제 미해결) | ❌ |
| **C. PointHistory에 focusSeconds 필드 추가** | 포인트 적립 시 초 단위도 저장 | 기존 API 구조 유지 | 데이터 중복, 마이그레이션 필요, 기존 데이터 손실 | ❌ |
| **D. 포인트 적립 단위 세분화** | 30분→1분 단위로 적립 | PointHistory 통일성 유지 | 레코드 60배 증가, 성능 저하, 시스템 전체 영향 | ❌ |

### 방법 A 선택 근거

1. **정확성**: `DailyFocusTime.totalFocusSeconds`는 실시간으로 초 단위 업데이트됨
2. **효율성**: 이미 저장된 데이터 활용, 추가 저장 공간 불필요
3. **영향 최소화**: API endpoint 변경 없음, 백엔드 로직만 수정
4. **데이터 무결성**: 기존 데이터 마이그레이션 불필요

### 방법 B가 안 되는 이유

```typescript
// PointHistory.amount는 30분 단위로만 적립됨
// 예: 1시간 31분 30초 집중 → amount = 3 (30분 × 3)
// 1시간 30분 집중 → amount = 3 (30분 × 3)
// → SUM(amount)도 동일하게 3으로 동점 처리됨
```

---

## 변경 계획

### 목표

`FOCUSED` 타입의 순위 조회 시 `DailyFocusTime.totalFocusSeconds`의 **SUM**을 기준으로 순위를 매기도록 변경

### 접근 방식

**방법 A (권장)**: `PointHistoryService`에 FocusTime 조회 로직 분기 추가

- 장점: API endpoint 변경 없음, 클라이언트 수정 불필요
- 단점: PointHistoryService가 FocusTime을 알게 됨 (의존성 추가)

**방법 B**: FocusTimeService에 별도 순위 API 추가

- 장점: 관심사 분리 유지
- 단점: 새 endpoint 필요, 클라이언트 수정 필요

→ **방법 A** 선택: 클라이언트 수정 없이 백엔드만 변경

---

## 상세 구현

### 용어 정의

| 용어 | 정의 |
|------|------|
| `weekendStartAt` | 조회 주간의 시작일 (월요일 00:00:00 KST) |
| 주간 범위 | `weekendStartAt` ~ `weekendStartAt + 7일` |

> **예시:** `weekendStartAt = 2026-01-26T00:00:00+09:00` → 2026-01-26(월) ~ 2026-02-01(일) 조회
>
> **Note:** `weekendStartAt` 명명이 혼동 여지가 있음 (weekend=주말 vs week start=주 시작). 향후 `weekStartAt`으로 변경 검토 필요.

### 1. FocusTimeService에 순위 조회 메서드 추가

**파일**: `backend/src/focustime/focustime.service.ts`

```typescript
// HistoryRank와 통일된 인터페이스 (count = 초 단위 집중 시간)
interface FocusRank {
  playerId: number;
  nickname: string;
  count: number;  // totalFocusSeconds 합계 (초 단위)
  rank: number;
}

async getFocusRanks(weekendStartAt: Date): Promise<FocusRank[]> {
  const weekendEndAt = new Date(weekendStartAt);
  weekendEndAt.setDate(weekendEndAt.getDate() + 7);

  const results = await this.focusTimeRepository
    .createQueryBuilder('ft')
    .select('ft.player_id', 'playerId')
    .addSelect('player.nickname', 'nickname')
    .addSelect('SUM(ft.total_focus_seconds)', 'count')
    .innerJoin('ft.player', 'player')
    .where('ft.createdAt >= :startAt AND ft.createdAt < :endAt', {
      startAt: weekendStartAt,
      endAt: weekendEndAt,
    })
    .groupBy('ft.player_id')
    .having('SUM(ft.total_focus_seconds) > 0')  // 0초 레코드 제외
    .orderBy('count', 'DESC')
    .getRawMany();

  // 동점자 처리: Standard Competition Ranking (1, 1, 3 방식)
  // 예: 1등(5400초), 1등(5400초), 3등(3600초) - 공동 1등 다음 3등
  ...
}
```

### 2. PointHistoryService에서 FOCUSED 타입 분기 처리

**파일**: `backend/src/pointhistory/point-history.service.ts`

```typescript
async getHistoryRanks(type: PointType, weekendStartAt: Date): Promise<HistoryRank[]> {
  // FOCUSED 타입은 FocusTimeService에서 조회
  if (type === PointType.FOCUSED) {
    return this.focusTimeService.getFocusRanks(weekendStartAt);
  }

  // 기존 로직 (다른 타입들)
  ...
}
```

### 3. 응답 형식 통일

현재 `HistoryRank`:
```typescript
interface HistoryRank {
  playerId: number;
  nickname: string;
  count: number;   // 레코드 개수
  rank: number;
}
```

변경 후에도 `count` 필드명을 유지하되, FOCUSED 타입의 경우 **초 단위 총 집중 시간**을 반환

```typescript
// FOCUSED 타입: count = totalFocusSeconds (초 단위)
// 프론트엔드에서 포맷팅하여 "1시간 30분" 등으로 표시
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/focustime/focustime.service.ts` | `getFocusRanks()` 메서드 추가 |
| `backend/src/focustime/focustime.module.ts` | FocusTimeService export 추가 (필요시) |
| `backend/src/pointhistory/point-history.module.ts` | FocusTimeModule import 추가 |
| `backend/src/pointhistory/point-history.service.ts` | FOCUSED 타입 분기 처리, FocusTimeService 의존성 주입 |
| `backend/src/pointhistory/point-history.service.spec.ts` | 테스트 추가/수정 |

---

## 프론트엔드 영향도

### API 변경 없음

- API endpoint 동일: `GET /api/history-ranks?type=FOCUSED&weekendStartAt=...`
- 응답 형식 동일: `{ playerId, nickname, count, rank }`
- **FOCUSED 타입의 count 의미 변경**: 레코드 개수 → 초 단위 총 집중 시간

### 프론트엔드 영향 (별도 이슈 #353에서 처리)

**#336 해결 후 UI 변화:**

| 항목 | 현재 | #336 해결 후 |
|------|------|-------------|
| 순위 | alice=1등, bob=1등 (동점) | alice=1등, bob=2등 ✅ |
| 표시 값 | 3, 3, 2 | 5490, 5400, 3600 |
| 단위 | 불명확 | 초 (포맷팅 안 됨) |

→ **순위는 정확해지지만, UI에 초 단위 숫자가 그대로 표시됨**

**포맷팅 옵션 검토:**

| 방법 | 백엔드 반환 | 프론트엔드 표시 | 장단점 |
|------|------------|----------------|--------|
| A. 초 유지 + 한글 포맷 | `5490` (초) | "1시간 31분 30초" | 가독성 좋음, UI 공간 많이 차지 |
| B. 초 유지 + 약어 포맷 | `5490` (초) | "1h 31m 30s" | UI 공간 절약, 국제적 표기 ✅ **채택** |
| C. 분으로 변환 | `91` (분) | "91분" 또는 "1시간 31분" | 간단, 초 단위 손실 |
| D. 문자열 반환 | `"1시간 31분"` | 그대로 표시 | FE 작업 없음, 유연성 떨어짐 |

**채택: 방법 B (약어 포맷)**

- 이유: UI 테이블 컬럼에서 한 줄에 표시 가능
- 형식: `"1h 31m 30s"`, `"45m 20s"`, `"30s"`

```typescript
// frontend/src/app/_components/LeaderboardModal/utils.ts
export function formatSecondsToHMS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
```

### 관련 프론트엔드 파일

| 파일 | 역할 | 변경 내용 |
|------|------|----------|
| `frontend/src/app/_components/LeaderboardModal/LeaderboardModal.tsx` | 리더보드 모달 | FOCUSED 탭 헤더 "포인트" → "시간" 변경, PlayerRow에 selectedTab 전달 |
| `frontend/src/app/_components/LeaderboardModal/utils.ts` | 유틸리티 함수 | `formatSecondsToHMS()` 추가 (초 → "Xh Ym Zs" 변환) |
| `frontend/src/app/_components/LeaderboardModal/PlayerRow.tsx` | 순위 행 렌더링 | selectedTab prop 추가, FOCUSED일 때 시간 형식 표시 |

### UI 변경 사항

| 탭 | 헤더 | 값 표시 예시 |
|----|------|-------------|
| 포인트 (ALL) | "포인트" | `131` |
| 집중 시간 (FOCUSED) | "시간" | `1h 31m 30s` |
| 기타 (COMMITTED 등) | "횟수" | `42` |

---

## 테스트 계획

### 단위 테스트

1. **FocusTimeService.getFocusRanks()**
   - 주간 범위 내 여러 일자의 집중 시간이 합산되는지 확인
   - 동점자 처리가 올바른지 확인
   - 집중 시간이 0인 플레이어는 제외되는지 확인

2. **PointHistoryService.getHistoryRanks()**
   - `type=FOCUSED`일 때 FocusTimeService로 분기되는지 확인
   - 다른 타입은 기존 로직 유지되는지 확인

### E2E 테스트

```bash
# 집중시간 순위 조회
curl "http://localhost:8080/api/history-ranks?type=FOCUSED&weekendStartAt=2026-01-26T00:00:00.000Z"

# 예상 응답
[
  { "playerId": 1, "nickname": "alice", "count": 7200, "rank": 1 },  // 2시간
  { "playerId": 2, "nickname": "bob", "count": 3600, "rank": 2 }     // 1시간
]
```

---

## 변경 후 검증 방법

### 수동 검증 (구현 완료 후)

```bash
#!/bin/bash
# scripts/verify-issue-336.sh

echo "=== Issue #336 검증: 집중시간 순위 정확성 ==="

# 1. DailyFocusTime 기준 예상 순위
echo -e "\n[1] 예상 순위 (DailyFocusTime 기준):"
sqlite3 backend/database.sqlite "
SELECT
  p.nickname,
  SUM(ft.total_focus_seconds) as total_seconds,
  printf('%d시간 %d분', SUM(ft.total_focus_seconds) / 3600, (SUM(ft.total_focus_seconds) % 3600) / 60) as formatted
FROM daily_focus_time ft
JOIN players p ON ft.player_id = p.id
WHERE ft.created_at >= datetime('now', '-7 days')
GROUP BY ft.player_id
HAVING total_seconds > 0
ORDER BY total_seconds DESC
LIMIT 10;
"

# 2. API 응답
echo -e "\n[2] 실제 API 응답:"
WEEK_START=$(date -d "last monday" -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -v-monday -u +"%Y-%m-%dT%H:%M:%S.000Z")
curl -s "http://localhost:8080/api/history-ranks?type=FOCUSED&weekendStartAt=$WEEK_START" | jq '.[] | {nickname, count, formatted: "\(.count / 3600 | floor)시간 \((.count % 3600) / 60 | floor)분", rank}'

echo -e "\n=== [1]과 [2]의 순위가 일치해야 함 ==="
```

### 검증 체크리스트

| 검증 항목 | 확인 방법 | 기대 결과 |
|----------|----------|----------|
| 순위 정확성 | DB SUM vs API count 비교 | 값이 일치해야 함 |
| 동점자 처리 | 같은 초 집중한 플레이어 확인 | 같은 rank 부여 (1, 1, 3 방식) |
| 0초 제외 | 집중 기록 없는 플레이어 | 결과에 포함되지 않아야 함 |
| 기존 타입 유지 | `type=COMMITTED` 등 다른 타입 | 기존과 동일하게 동작 |

### 회귀 테스트 시나리오

추후 코드 변경 시 아래 시나리오가 통과해야 합니다:

```typescript
// backend/src/focustime/focustime.service.spec.ts

describe('getFocusRanks', () => {
  it('주간 범위 내 여러 일자의 집중 시간이 합산된다', async () => {
    // Given: player A가 월요일 1시간, 화요일 30분 집중
    await createFocusTime(playerA, monday, 3600);  // 1시간
    await createFocusTime(playerA, tuesday, 1800); // 30분

    // When
    const ranks = await service.getFocusRanks(mondayStart);

    // Then: 총 5400초 (1시간 30분)
    expect(ranks.find(r => r.playerId === playerA.id).count).toBe(5400);
  });

  it('세밀한 시간 차이가 순위에 반영된다', async () => {
    // Given: A=5490초, B=5400초 (90초 차이)
    await createFocusTime(playerA, monday, 5490);
    await createFocusTime(playerB, monday, 5400);

    // When
    const ranks = await service.getFocusRanks(mondayStart);

    // Then: A가 1등, B가 2등 (이전에는 동점 처리됨)
    expect(ranks[0].playerId).toBe(playerA.id);
    expect(ranks[0].rank).toBe(1);
    expect(ranks[1].playerId).toBe(playerB.id);
    expect(ranks[1].rank).toBe(2);
  });

  it('집중 시간이 0인 플레이어는 제외된다', async () => {
    // Given: A=3600초, B=0초
    await createFocusTime(playerA, monday, 3600);
    await createFocusTime(playerB, monday, 0);

    // When
    const ranks = await service.getFocusRanks(mondayStart);

    // Then: B는 결과에 없어야 함
    expect(ranks.map(r => r.playerId)).not.toContain(playerB.id);
  });

  it('동점자는 같은 순위를 부여한다 (Standard Competition Ranking)', async () => {
    // Given: A=3600초, B=3600초, C=1800초
    await createFocusTime(playerA, monday, 3600);
    await createFocusTime(playerB, monday, 3600);
    await createFocusTime(playerC, monday, 1800);

    // When
    const ranks = await service.getFocusRanks(mondayStart);

    // Then: A,B=1등, C=3등 (2등 없음)
    expect(ranks.filter(r => r.rank === 1)).toHaveLength(2);
    expect(ranks.find(r => r.playerId === playerC.id).rank).toBe(3);
  });
});

describe('getHistoryRanks - FOCUSED 타입 분기', () => {
  it('type=FOCUSED일 때 FocusTimeService로 분기한다', async () => {
    // Given
    const focusRanksSpy = jest.spyOn(focusTimeService, 'getFocusRanks');

    // When
    await service.getHistoryRanks(PointType.FOCUSED, mondayStart);

    // Then
    expect(focusRanksSpy).toHaveBeenCalledWith(mondayStart);
  });

  it('type=COMMITTED일 때 기존 로직을 사용한다', async () => {
    // Given
    const focusRanksSpy = jest.spyOn(focusTimeService, 'getFocusRanks');

    // When
    await service.getHistoryRanks(PointType.COMMITTED, mondayStart);

    // Then
    expect(focusRanksSpy).not.toHaveBeenCalled();
  });
});
```

### CI 파이프라인 검증

```yaml
# .github/workflows/backend-ci.yml에 포함되어야 할 테스트
- name: Run unit tests
  run: |
    cd backend
    pnpm test -- --testPathPattern="focustime.service.spec.ts|point-history.service.spec.ts"
```

---

## 체크리스트

### 구현

- [ ] FocusTimeService에 getFocusRanks() 메서드 추가
- [ ] FocusTimeModule에서 FocusTimeService export
- [ ] PointHistoryModule에서 FocusTimeModule import
- [ ] PointHistoryService에 FocusTimeService 의존성 주입
- [ ] PointHistoryService.getHistoryRanks()에서 FOCUSED 타입 분기 처리

### 테스트

- [ ] FocusTimeService.getFocusRanks() 단위 테스트 작성
- [ ] PointHistoryService FOCUSED 분기 테스트 작성
- [ ] 동점자 처리 테스트 (Standard Competition Ranking)
- [ ] 0초 제외 테스트
- [ ] 기존 타입 (COMMITTED 등) 회귀 테스트

### 검증

- [ ] 재현 스크립트로 문제 확인 (`scripts/reproduce-issue-336.sh`)
- [ ] 검증 스크립트로 수정 확인 (`scripts/verify-issue-336.sh`)
- [ ] DB SUM과 API count 값 일치 확인
- [ ] 프론트엔드 표시 형식 확인 (시간 포맷팅 필요 여부)
- [ ] CI 통과 확인
