# Issue #325: GitHub OAuth 로그인 시 Bad credentials 에러 (401)

## 이슈 링크

https://github.com/boostcampwm2025/web19-estrogenquattro/issues/325

## 문제 요약

GitHub OAuth 로그인 과정에서 `Failed to fetch user profile` 에러 발생 (401 Bad credentials)

## 에러 로그

```
InternalOAuthError: Failed to fetch user profile
  at passport-github2/lib/strategy.js:98:19

oauthError: {
  statusCode: 401,
  data: {
    "message": "Bad credentials",
    "documentation_url": "https://docs.github.com/rest",
    "status": "401"
  }
}
```

## 참조한 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md): GitHub OAuth 인증 흐름

## 관련 코드

| 파일 | 역할 |
|------|------|
| `backend/src/auth/github.strategy.ts` | GitHub OAuth 전략 (환경변수 사용) |
| `backend/src/auth/auth.controller.ts` | OAuth 콜백 처리 |

### github.strategy.ts:17-22

```typescript
super({
  clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
  clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
  callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
  scope: ['repo'],
});
```

## 분석 결과

### OAuth 흐름과 에러 발생 시점

```
1. /auth/github → GitHub 리다이렉트
2. 사용자 로그인 → authorization code 발급
3. 토큰 교환 (client_id + client_secret + code → access_token) ← client_secret 검증 시점
4. 프로필 조회 (access_token → /user API) ← 여기서 401 발생
```

**핵심 포인트:** 에러가 4단계(프로필 조회)에서 발생합니다. 만약 Client Secret이 잘못되었다면 3단계(토큰 교환)에서 먼저 실패해야 합니다. "Failed to fetch user profile" 에러는 **토큰 교환이 성공했지만 발급된 토큰이 유효하지 않음**을 시사합니다.

### 가능한 원인 (우선순위순)

1. **GitHub App credentials 사용** (가능성 높음)
   - OAuth App이 아닌 GitHub App의 credentials를 사용한 경우
   - GitHub App은 다른 인증 방식(JWT + Installation Token)을 사용
   - OAuth App인지 GitHub App인지 확인 필요

2. **GitHub Enterprise 사용 시 커스텀 URL 미설정**
   - `api.github.com` 대신 커스텀 API 엔드포인트가 필요한 경우
   - `authorizationURL`, `tokenURL`, `userProfileURL` 설정 필요

3. **환경변수 불일치** (가능성 낮음)
   - Client Secret 만료/변경 시 토큰 교환 단계에서 실패해야 함
   - 단, 토큰 교환 성공 후 프로필 조회 실패라면 다른 원인일 가능성 높음

4. **OAuth App 삭제/비활성화**
   - GitHub에서 OAuth App이 삭제되었거나 비활성화됨

## 해결 방법

### 0단계: 토큰 교환 로그 확인 (진단)

먼저 토큰 교환이 성공했는지 확인합니다:

```bash
# PM2 로그에서 OAuth 관련 로그 확인
pm2 logs --lines 100 | grep -i "oauth\|token\|auth"
```

- 토큰 교환 실패 로그가 있다면 → Client Secret 문제 가능성
- 토큰 교환 성공 후 프로필 조회 실패 → 아래 1단계부터 진행

### 1단계: OAuth App vs GitHub App 확인

1. GitHub → Settings → Developer settings
2. **OAuth Apps** 탭에서 앱이 있는지 확인 (GitHub Apps 탭이 아님!)
3. OAuth App이 아닌 GitHub App credentials를 사용 중이라면:
   - OAuth App을 새로 생성하거나
   - GitHub App 인증 방식으로 코드 변경 필요

### 2단계: GitHub OAuth App 설정 확인

1. GitHub → Settings → Developer settings → **OAuth Apps**
2. 해당 OAuth App 선택
3. 확인 사항:
   - **Client ID**: 서버 환경변수와 일치하는지
   - **Client Secret**: 재생성 필요 시 "Generate a new client secret"
   - **Authorization callback URL**: `https://{도메인}/auth/github/callback`

### 3단계: 서버 환경변수 업데이트

```bash
# PM2가 backend 디렉토리에서 실행되므로 backend/.env 확인
cat backend/.env | grep GITHUB

# 필요 시 업데이트
GITHUB_CLIENT_ID=새로운_클라이언트_ID
GITHUB_CLIENT_SECRET=새로운_클라이언트_시크릿
GITHUB_CALLBACK_URL=https://도메인/auth/github/callback
```

### 4단계: GitHub Enterprise 사용 시 (해당되는 경우만)

GitHub Enterprise를 사용하는 경우 `github.strategy.ts`에서 커스텀 URL 설정이 필요합니다:

```typescript
super({
  clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
  clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
  callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
  scope: ['repo'],
  // GitHub Enterprise 설정 (필요 시)
  authorizationURL: 'https://github.example.com/login/oauth/authorize',
  tokenURL: 'https://github.example.com/login/oauth/access_token',
  userProfileURL: 'https://github.example.com/api/v3/user',
});
```

### 5단계: 서버 재시작

```bash
pnpm deploy
# 또는
pm2 restart all
```

## 체크리스트

- [ ] 토큰 교환 로그 확인 (성공/실패 여부)
- [ ] OAuth App vs GitHub App 확인 (Developer settings에서)
- [ ] GitHub OAuth App 설정 확인 (Client ID, Client Secret)
- [ ] 서버 환경변수 확인/업데이트 (`backend/.env`)
- [ ] Callback URL 확인 (`/auth/github/callback`)
- [ ] GitHub Enterprise 사용 여부 확인
- [ ] 서버 재시작
- [ ] 로그인 테스트

## 비고

- **대부분의 경우** 환경 설정 확인/수정만으로 해결 가능
- **코드 변경이 필요한 경우:**
  - GitHub Enterprise 사용 시 커스텀 URL 설정 필요
  - GitHub App credentials 사용 시 인증 방식 변경 필요
- 프로덕션 환경에서 발생한 경우 서버 관리자가 처리해야 함
