# GitHub Polling 개선 작업

> 관련 PR: [#35 feat: public api(인증X) github 폴링 및 브로드 캐스팅](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/35)
> 참고 문서: [GITHUB_API_STRATEGY.md](./GITHUB_API_STRATEGY.md)

## 목표

- Public API → OAuth 토큰 인증 API로 전환
- ETag를 활용한 Conditional Request로 Rate Limit 최적화
- 동적 폴링 전략으로 실시간성 향상 (304→10초, 200→60초)
- GitHub 커밋에 따라 프로그레스바 연동

---

## 현재 상태 vs 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| 사용자 식별 | ~~하드코딩~~ | ✅ 로그인한 사용자의 username |
| API 인증 | ~~Public API~~ | ✅ OAuth Access Token (`repo` scope) |
| Rate Limit | ~~60 req/hour~~ | ✅ 5,000 req/hour (인증) |
| 폴링 주기 | ~~60초 고정~~ | ✅ 동적 (10초~60초) |
| ETag 최적화 | ~~미적용~~ | ✅ 적용 |
| 429 에러 처리 | ~~미적용~~ | ✅ 백오프 전략 |
| 프로그레스바 | ~~임시 로직 (2초마다 10%)~~ | ✅ GitHub 커밋 연동 |

---

## Phase 1: OAuth 토큰 연동 ✅

| 순서 | 작업 | 상태 |
|:---:|------|:---:|
| 1 | `GithubPollService`에서 사용자별 Access Token 조회 | ✅ |
| 2 | API 호출 시 `Authorization: Bearer {token}` 헤더 추가 | ✅ |
| 3 | 하드코딩된 username → JWT에서 추출한 username으로 변경 | ✅ |

---

## Phase 2: ETag Conditional Request 구현 ✅

| 순서 | 작업 | 상태 |
|:---:|------|:---:|
| 4 | `etagMap: Map<username, string>` 추가 | ✅ |
| 5 | 응답 헤더에서 ETag 추출 및 저장 | ✅ |
| 6 | 요청 시 `If-None-Match: {etag}` 헤더 추가 | ✅ |
| 7 | 304 응답 처리 (변경 없음 → Rate Limit 미차감) | ✅ |

---

## Phase 3: 동적 폴링 전략 ✅

| 순서 | 작업 | 상태 |
|:---:|------|:---:|
| 8 | 동적 폴링 전략 구현 (응답에 따라 간격 조절) | ✅ |
| 9 | 429 에러 처리 및 백오프 전략 | ✅ |

### 동적 폴링 구현

```typescript
// github.poll-service.ts
const POLL_INTERVAL_FAST = 10_000;    // 304 응답 시 (변경 없음)
const POLL_INTERVAL_SLOW = 60_000;    // 200 응답 시 (새 데이터)
const POLL_INTERVAL_BACKOFF = 120_000; // 429 응답 시 (rate limit)

switch (result.status) {
  case 'no_changes':    nextInterval = POLL_INTERVAL_FAST; break;
  case 'new_events':    nextInterval = POLL_INTERVAL_SLOW; break;
  case 'rate_limited':  nextInterval = retryAfter || POLL_INTERVAL_BACKOFF; break;
}
```

---

## Phase 4: 프로그레스바 GitHub 커밋 연동 ✅

> 관련 PR: [#31 feat: 맵 중앙에 프로그레스바 UI 구현](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/31)

| 순서 | 작업 | 상태 |
|:---:|------|:---:|
| 10 | 프론트엔드에서 `github_event` Socket 이벤트 리스너 추가 | ✅ |
| 11 | 임시 프로그레스 로직 제거 | ✅ |
| 12 | GitHub 커밋 이벤트 수신 시 프로그레스바 업데이트 | ✅ |
| 13 | 프로그레스바 증가 로직 설계 (커밋당 증가량 등) | ✅ |

### 연동 흐름

```
GitHub 커밋 → 백엔드 폴링 감지 → WebSocket 이벤트 전송 → 프론트엔드 프로그레스바 업데이트
```

### 프로그레스바 규칙

| 항목 | 결정 |
|------|------|
| 커밋당 증가량 | **2%** |
| PR당 증가량 | **5%** |
| 100% 도달 시 | **리셋 (0%로 초기화)** |
| 합산 방식 | **같은 방 사용자들의 커밋 합산** (room 브로드캐스트) |

---

## Phase 5: 개인 기여 표시 ✅

| 순서 | 작업 | 상태 |
|:---:|------|:---:|
| 14 | `GithubEventData`에 username 필드 추가 | ✅ |
| 15 | 프론트엔드 기여도 UI 컴포넌트 생성 (`createContributionList.ts`) | ✅ |
| 16 | MapScene에서 기여도 추적 및 표시 | ✅ |

### 기여도 표시 규칙

| 항목 | 결정 |
|------|------|
| 표시 위치 | 프로그레스바 아래 |
| 표시 형식 | `username:숫자` (예: heisjun:5, fpg123:3) |
| 최대 표시 | 상위 5명 (기여도 순 정렬) |
| 리셋 | 프로그레스바 리셋 시 기여도는 유지 |

---

## 테스트 방법

### ETag 동작 확인

```
1. 백엔드 로그 확인
2. 첫 번째 폴링: status: 200, ETag 값 반환
3. GitHub 활동 없이 대기
4. 두 번째 폴링: status: 304 (Rate Limit 미차감)
5. GitHub에서 커밋 푸시
6. 세 번째 폴링: status: 200, 새 ETag
```

### 프로그레스바 연동 확인

```
1. 로그인 → 방 입장
2. GitHub에서 커밋 푸시
3. 10~60초 이내에 프로그레스바 증가 확인 (동적 폴링)
   - 첫 폴링 후 304 응답 시: 10초 후 재시도
   - 새 이벤트 감지 시: 60초 후 재시도
```

---

## 상태 범례

- ⬜ 대기
- 🔄 진행 중
- ✅ 완료

---

## 참고 링크

- [GitHub Events API](https://docs.github.com/en/rest/activity/events)
- [Conditional Requests](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#conditional-requests)
- [Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)
