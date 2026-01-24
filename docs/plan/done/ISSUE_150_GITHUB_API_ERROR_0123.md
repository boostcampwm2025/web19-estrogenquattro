# Issue #150: GitHub API 네트워크 에러 시 서버 크래시

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#150](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/150) |
| 제목 | GitHub API 네트워크 에러 시 서버 크래시 |
| 영역 | Backend |
| 브랜치 | `fix/github-api-error-handling` |

---

## 참조한 문서

- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md): GitHub 폴링 시스템 구조

---

## 문제 상황

**재현 방법:**
1. 백엔드 서버 실행
2. 사용자 로그인 (GitHub 폴링 시작)
3. 네트워크 불안정 또는 GitHub API 응답 지연 발생
4. 서버 크래시

**에러 로그:**
```
TypeError: fetch failed
  [cause]: ConnectTimeoutError: Connect Timeout Error (api.github.com:443, timeout: 10000ms)
```

---

## 원인 분석

`backend/src/github/github.poll-service.ts`의 `pollGithubEvents` 메서드에서 `fetch` 호출이 try-catch로 감싸져 있지 않음:

```typescript
// 현재 코드 (210번 줄)
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers,
  body: JSON.stringify({ query, variables: { username } }),
});
```

---

## 해결 방안

**try-catch로 fetch 감싸기** - 에러 발생 시 graceful하게 처리하고 다음 폴링 주기(30초)에 재시도

### 방안 선택 이유

| 방안 | 채택 | 이유 |
|------|------|------|
| try-catch만 | ✅ | 구현 단순, 기존 30초 폴링이 재시도 역할 수행 |
| AbortController 타임아웃 | ❌ | 현재 규모에서 과도한 설계, 추후 필요시 추가 |

---

## 상세 구현

### 수정 코드

```typescript
// 변경 전
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers,
  body: JSON.stringify({ query, variables: { username } }),
});

// 변경 후
let res: Response;
try {
  res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: { username } }),
  });
} catch (error) {
  this.logger.error(
    `[${username}] GitHub API network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
  );
  return { status: 'error' };
}

// 이하 기존 로직 동일...
```

### 에러 발생 시 흐름

```
fetch() 에러 발생 → catch 블록 → 로그 출력 → { status: 'error' } 반환
    → handlePoll() switch문 → nextInterval = 30초 → 30초 후 재시도
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/github.poll-service.ts` | fetch에 try-catch 추가 |

---

## 테스트 계획

### CI 테스트
```bash
cd backend && pnpm lint && pnpm format && pnpm build && pnpm test
```

### 수동 테스트
- [ ] 네트워크 끊김 시뮬레이션 (VPN 끊기, 방화벽 차단 등)
- [ ] 서버 로그에 에러 메시지 출력 확인
- [ ] 서버 크래시 없이 다음 폴링 진행 확인

### 크래시 재현 (소스 코드 수정)

fetch URL을 존재하지 않는 호스트로 변경하여 빠르게 재현 가능:

```typescript
// backend/src/github/github.poll-service.ts (210번 줄)

// 변경 전
const res = await fetch('https://api.github.com/graphql', {

// 변경 후 (크래시 재현용)
const res = await fetch('https://invalid-host-does-not-exist.local/graphql', {
```

**재현 순서:**
1. 위와 같이 코드 수정
2. `cd backend && pnpm start:dev`
3. 브라우저에서 로그인
4. 1초 뒤 크래시 발생:
   ```
   TypeError: fetch failed
     [cause]: Error: getaddrinfo ENOTFOUND invalid-host-does-not-exist.local
   ```

> **주의:** 테스트 후 반드시 원래 URL로 원복할 것

---

## 커밋 계획

```bash
git checkout -b fix/github-api-error-handling

git commit -m "$(cat <<'EOF'
fix: GitHub API 네트워크 에러 시 서버 크래시 방지

- fetch 호출을 try-catch로 감싸서 네트워크 에러 핸들링
- 에러 발생 시 로그 출력 후 다음 폴링 주기(30초)에 재시도

close #150

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## PR 정보

**제목:** `fix: GitHub API 네트워크 에러 시 서버 크래시 방지`

**본문:**
```markdown
## 🔗 관련 이슈
- close: #150

## ✅ 작업 내용
- fetch 호출을 try-catch로 감싸서 네트워크 에러 핸들링
- 에러 발생 시 로그 출력 후 다음 폴링 주기(30초)에 재시도

## 💡 체크리스트
- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?
```

---

## 관련 문서

- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md) - GitHub 폴링 시스템
- [WEEKEND_BUGS.md](./20260123_WEEKEND_BUGS.md) - 주말 버그 목록
