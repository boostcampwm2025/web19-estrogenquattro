# Issue #366: GitHub OAuth scope 과도한 권한 요청 제거

## 참조한 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md): 현재 OAuth 구현 확인
- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md): GitHub API 사용 현황 확인

## 이슈 요약

GitHub OAuth 로그인 시 `scope: ['repo']`로 인해 private repository에 대한 **전체 제어 권한**(읽기/쓰기/삭제)을 요청하고 있음. 사용자 입장에서 단순 활동 추적 서비스에 과도한 권한 요청.

## 현재 구조

### OAuth 설정 (브랜치별 차이)

| 브랜치 | scope | 상태 |
|--------|-------|------|
| main | `['repo']` | 과도한 권한 |
| temp/deploy (운영) | `['read:user']` | 이미 수정됨 |

```typescript
// main 브랜치 (backend/src/auth/github.strategy.ts:21)
scope: ['repo'], // private repo 활동 감지를 위한 권한

// temp/deploy 브랜치 (운영)
scope: ['read:user'],
```

### 실제 사용 API

| API | 용도 | 필요 권한 |
|-----|------|----------|
| `GET /users/{username}/events/public` | 활동 조회 | 없음 (public만) |
| `GET /repos/{owner}/{repo}/compare/...` | 커밋 상세 | 없음 (public repo) |
| `GET /repos/{owner}/{repo}/pulls/{number}` | PR 제목 | 없음 (public repo) |

### 발견된 문제

1. **`repo` scope 불필요**: 현재 `/events/public` 엔드포인트는 scope와 무관하게 public 이벤트만 반환
2. **private 이벤트 미지원**: 엔드포인트가 `/events/public`이므로 private repo 활동은 어차피 감지 안 됨
3. **과도한 권한**: `repo` scope는 private repo에 대한 전체 제어 권한 부여

## GitHub OAuth Scopes 분석

| Scope | 권한 | 판단 |
|-------|------|------|
| `repo` | private repo 전체 제어 (읽기/쓰기/삭제) | ❌ 과도함 |
| `read:user` | 사용자 프로필 읽기 | ✅ 채택 (운영 동기화) |
| `public_repo` | public repo 읽기/쓰기 | ❌ 불필요 |
| (없음) | public 정보만 읽기 | ⚪ 기능상 충분하나 운영과 불일치 |

> **결정 근거:** 기능상 scope 없이도 동작하지만, **운영 환경(temp/deploy)과의 동기화**를 우선하여 `read:user` 채택

### Events API 권한 요구사항

GitHub 문서에 따르면:
- **토큰에 특정 권한이 필요하지 않음**
- 인증된 사용자가 **자신의** 이벤트를 조회할 때 private 이벤트도 포함됨
- 단, `/events/public` 엔드포인트는 항상 public 이벤트만 반환

## 변경 계획

### main 브랜치에 temp/deploy 설정 반영

운영(temp/deploy)과 동일하게 `scope: ['read:user']`로 변경

```typescript
// 변경 전 (main)
scope: ['repo'], // private repo 활동 감지를 위한 권한

// 변경 후 (temp/deploy와 동일)
scope: ['read:user'],
```

**장점:**
- 최소 권한 원칙 준수
- 사용자 신뢰도 향상
- 운영 환경과 일치
- 현재 기능에 영향 없음

### 기존 사용자 토큰 영향

| 환경 | 현재 scope | 영향 |
|------|-----------|------|
| 운영 (temp/deploy) | `read:user` | 없음 (이미 동일) |
| 개발 (main) | `repo` → `read:user` | 개발자만 해당 |

- 운영 사용자는 이미 `read:user` 토큰으로 발급됨
- main 브랜치 변경은 **개발 환경 동기화**일 뿐, 운영 사용자에게 영향 없음
- 별도의 토큰 회수/재로그인 유도 불필요

---

### 향후 고려: private 이벤트 지원 (이번 이슈 범위 아님)

> ⚠️ **이 옵션은 별도 이슈로 진행해야 함**. 이번 이슈는 main → temp/deploy 동기화만 수행.

private repo 활동도 추적하려면 추가 고려사항이 많음:

#### 1. 엔드포인트 변경

```typescript
// /events/public → /events
const url = `https://api.github.com/users/${username}/events?per_page=100`;
```

#### 2. Compare/PR API 에러 처리 필요

private repo 이벤트 감지 시 후속 API 호출(Compare, PR)에서 **403/404 발생 가능**:

| API | private repo 접근 시 | 필요 조치 |
|-----|---------------------|----------|
| `/users/{username}/events` | ✅ 접근 가능 (scope 불필요) | - |
| `/repos/{owner}/{repo}/compare/...` | ❌ 403 Forbidden | `repo` scope 또는 에러 처리 |
| `/repos/{owner}/{repo}/pulls/{number}` | ❌ 403 Forbidden | `repo` scope 또는 에러 처리 |

#### 3. 선택지

| 방안 | 설명 | 권한 | 구현 복잡도 |
|------|------|------|-----------|
| A | private 이벤트 무시 (public만 처리) | 없음 | 낮음 |
| B | private 이벤트는 상세 정보 없이 카운트만 | 없음 | 중간 |
| C | `repo` scope 유지하고 private 완전 지원 | `repo` | 낮음 |

**방안 A/B 구현 시 필요한 변경:**

```typescript
// github.poll-service.ts - getCommitDetails, getPrTitle에 에러 처리 추가
private async getCommitDetails(...) {
  try {
    const res = await fetch(url, { headers });
    if (res.status === 403 || res.status === 404) {
      // private repo - fallback 반환
      return { count: 1, messages: ['(private repo)'] };
    }
    // ...
  } catch {
    return { count: 1, messages: ['(unknown)'] };
  }
}
```

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/auth/github.strategy.ts` | `scope: ['repo']` → `scope: ['read:user']` |
| `docs/features/AUTH_FLOW.md` | scope 관련 문서 업데이트 |

## 구현 순서

1. `github.strategy.ts`에서 `scope: ['read:user']`로 변경
2. 로컬에서 새 브라우저/시크릿 모드로 로그인 테스트
3. GitHub 활동 폴링 정상 동작 확인
4. 문서 업데이트
5. CI 검사 통과 확인

## 테스트 계획

### 1. 로그인 테스트

- [ ] 새 브라우저에서 GitHub OAuth 로그인 시 권한 요청 화면 확인
  - "Full control of private repositories" 문구가 **없어야 함**
- [ ] 로그인 성공 후 `/auth/me` 정상 응답 확인

### 2. 폴링 테스트

- [ ] 접속 후 GitHub 활동 폴링 시작 확인 (서버 로그)
- [ ] public repo에 커밋 push 후 감지 확인
- [ ] public repo에 PR 생성 후 감지 확인

## 브랜치

```
fix/#366-github-oauth-scope
```

## 관련 이슈

- close: #366

## 참고 자료

- [GitHub OAuth Scopes 문서](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub Events API 문서](https://docs.github.com/en/rest/activity/events)
- 커밋 `94e55a80` (2025-12-18, PR #35)에서 `repo` scope 추가됨
