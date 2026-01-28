# GitHub GraphQL 쿼리 개선 계획

> **관련 이슈**: [#234](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/234)
> **작성일**: 2025-01-25
> **상태**: ❌ 폐기 (GraphQL → REST API 전환으로 인해 불필요)

---

## 1. 현황 분석

### 현재 쿼리

```graphql
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
    }
  }
}
```

### 시스템 목적 부합도

| 항목 | 평가 |
|------|------|
| 목적 | GitHub 활동을 실시간으로 감지하여 게임 프로그레스바에 반영 |
| 쿼리 적합성 | ✅ 적합 - 총량 기반 조회로 증가분 계산에 효율적 |
| 프로그레스 반영 | ✅ 커밋(+2%), PR(+5%) 증가량 계산 가능 |
| 단순성 | ✅ 필요한 필드만 요청 (최소 포인트 소비) |

---

## 2. 엣지케이스 및 문제점

### 2.1 시간 범위 미지정

```
현재: contributionsCollection { ... }  (기본값: 지난 1년)
권장: contributionsCollection(from: $from, to: $to) { ... }
```

| 상황 | 영향 |
|------|------|
| 1년 전 오늘 기여 삭제 | 총량 감소 → 음수 증가분 (현재 `Math.max(0, ...)` 로 처리) |
| 연말/연초 경계 | 1년 범위가 자동 롤링되어 예기치 않은 카운트 변화 가능 |

### 2.2 비공개 리포지토리 기여

- `contributionsCollection`은 기본적으로 **공개 리포지토리 기여만** 포함
- 비공개 기여는 `restrictedContributionsCount`에 별도 집계
- 현재 쿼리는 비공개 기여를 **추적하지 않음**

### 2.3 사용자 존재 여부 미확인

```typescript
const contributionsCollection = json.data?.user?.contributionsCollection;
if (!contributionsCollection) {
  return { status: 'no_changes' };  // 사용자 미존재도 같은 처리
}
```

- GitHub username 변경/삭제 시 `user`가 `null`
- 에러로 처리하지 않고 `no_changes`로 처리됨 (조용히 실패)

### 2.4 Rebase/Squash로 인한 커밋 수 변화

| 시나리오 | 결과 |
|----------|------|
| 5개 커밋 → squash → 1개 | `totalCommitContributions` 감소 |
| 현재 처리 | `Math.max(0, diff)` → 무시됨 |

### 2.5 GraphQL 에러 응답 처리

모든 GraphQL 에러를 동일하게 처리. 구체적인 에러 유형(인증 만료, 쿼리 오류 등) 구분 없음.

---

## 3. Rate Limit 분석

### 현재 상황

현재 시스템은 **각 사용자의 OAuth accessToken**으로 GraphQL API를 호출합니다.

| 항목 | 값 |
|------|-----|
| 각 사용자 제한 | **5,000포인트/시간 (사용자별)** |
| 폴링 빈도 | 30초 간격 = 120회/시간 |
| 사용자별 소비량 | 120포인트/시간 (쿼리당 1포인트) |
| 사용률 | 120 / 5,000 = **2.4%** |

> **참고**: 각 사용자가 독립적으로 5,000포인트를 보유하므로 **동시 사용자 수 제한 없음**

### 개선 시 예상 영향

**포인트 계산 방식** (GitHub 공식 문서):
1. 각 연결별 필요한 요청 수 합산 (`first`/`last` 한계 도달 가정)
2. 합계를 100으로 나누고 가장 가까운 정수로 반올림
3. 최소값: 1포인트

**예상 계산** (상세 정보 쿼리 기준):
- `issueContributions(first: 5)` → 5
- `pullRequestContributions(first: 5)` → 5
- `commitContributionsByRepository(maxRepositories: 5).contributions(first: 5)` → 25
- 총합: 35 → 35 ÷ 100 = 0.35 → 반올림 → **1포인트**

| 쿼리 유형 | 예상 포인트 | 사용자별 사용률 |
|----------|-------------|-----------------|
| 현재 (총량만) | 1 | 2.4% |
| 상세 정보 추가 (first: 5) | ~1-2 | 2.4-4.8% |
| 상세 정보 추가 (first: 10) | ~2-3 | 4.8-7.2% |

> **보조 속도 제한**: GraphQL은 분당 2,000포인트 초과 불가 (30초 간격 폴링으로 충분히 여유)

---

## 4. 개선 목표

### 4.1 상세 활동 정보 추가

- [ ] 커밋 상세 정보 (레포지토리명, 커밋 메시지)
- [ ] 이슈 상세 정보 (이슈 제목, 레포지토리명)
- [ ] PR 상세 정보 (PR 제목, 레포지토리명)

### 4.2 안정성 개선

- [ ] 시간 범위 명시 (`from`/`to` 파라미터)
- [ ] 비공개 리포지토리 기여 추적 (`restrictedContributionsCount`)
- [ ] 사용자 미존재 시 명시적 에러 처리

---

## 5. 개선된 쿼리 (안)

```graphql
query($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      # 기존 총량 필드
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount

      # 커밋 상세 (레포지토리별)
      commitContributionsByRepository(maxRepositories: 5) {
        repository {
          name
          owner { login }
        }
        contributions(first: 5) {
          nodes {
            commitCount
            occurredAt
          }
        }
      }

      # 이슈 상세
      issueContributions(first: 5, orderBy: { direction: DESC }) {
        nodes {
          issue {
            title
            number
            repository { nameWithOwner }
          }
          occurredAt
        }
      }

      # PR 상세
      pullRequestContributions(first: 5, orderBy: { direction: DESC }) {
        nodes {
          pullRequest {
            title
            number
            repository { nameWithOwner }
          }
          occurredAt
        }
      }
    }
  }

  # Rate Limit 모니터링
  rateLimit {
    remaining
    resetAt
  }
}
```

---

## 6. 구현 계획

### Phase 1: 안정성 개선

1. 시간 범위 파라미터 추가 (`from`: 오늘 00:00, `to`: 현재 시각)
2. `restrictedContributionsCount` 추가
3. 사용자 미존재 시 명시적 에러 처리

### Phase 2: 상세 정보 추가

1. 커밋 상세 정보 추가 (레포지토리명)
2. 이슈/PR 상세 정보 추가 (제목, 레포지토리명)
3. 프론트엔드 UI 연동 (활동 피드 표시)

### Phase 3: 최적화

1. Rate Limit 모니터링 추가
2. 상세 정보 조회 주기 분리 (폴링과 별도)
3. 캐싱 전략 수립

---

## 7. 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/github.poll-service.ts` | GraphQL 쿼리 수정, 응답 파싱 |
| `backend/src/github/github.gateway.ts` | 상세 정보 브로드캐스트 |
| `docs/api/GITHUB_POLLING.md` | 문서 업데이트 |

---

## 8. 결론

| 평가 항목 | 현재 | 개선 후 |
|----------|------|---------|
| 시스템 목적 부합 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 쿼리 효율성 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ |
| 엣지케이스 처리 | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ |
| 기능 확장성 | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ |

현재 쿼리는 시스템 목적에 잘 부합하지만, 상세 활동 정보 추가로 사용자 경험을 향상시킬 수 있습니다. Rate Limit 영향을 고려하여 단계적으로 구현하는 것을 권장합니다.
