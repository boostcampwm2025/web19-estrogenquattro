# 인증 흐름

## 개요

GitHub OAuth2 + JWT 쿠키 기반 인증 시스템

---

## 전체 흐름

```
[1] 사용자 → GET /auth/github → GitHub 로그인 페이지
                                        ↓
[2]                             GitHub OAuth 인증
                                        ↓
[3] GitHub → GET /auth/github/callback → 서버
                                        ↓
[4] 서버: JWT 생성 → httpOnly 쿠키 설정
                                        ↓
[5] 리다이렉트 → /auth/callback (프론트엔드)
                                        ↓
[6] 프론트엔드: /auth/me 호출 → 사용자 정보 획득
```

---

## 엔드포인트 상세

### GET /auth/github

GitHub OAuth 로그인 시작

```typescript
@Get('github')
@UseGuards(GithubGuard)
github() {
  // GithubGuard가 GitHub 로그인 페이지로 리다이렉트
}
```

**OAuth Scope:**
```typescript
scope: ['repo']  // private repo 활동 감지를 위한 권한
```

---

### GET /auth/github/callback

GitHub OAuth 콜백 처리

```typescript
@Get('github/callback')
@UseGuards(GithubGuard)
githubCallback(@Req() req: Request, @Res() res: Response) {
  const user = req.user as User;

  // JWT 토큰 생성
  const token = this.jwtService.sign({
    sub: user.githubId,
    username: user.username,
  });

  // httpOnly 쿠키 설정
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: false,           // HTTPS 사용 시 true
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,  // 1일
    path: '/',
  });

  res.redirect(`${frontendUrl}/auth/callback`);
}
```

---

### GET /auth/me

현재 사용자 정보 조회 (JWT 검증 필요)

```typescript
@Get('me')
@UseGuards(JwtGuard)
me(@Req() req: Request) {
  const { githubId, username, avatarUrl } = req.user as User;
  return { githubId, username, avatarUrl };
}
```

**응답:**
```json
{
  "githubId": "12345678",
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345678"
}
```

---

### GET /auth/logout

로그아웃 (쿠키 삭제)

```typescript
@Get('logout')
logout(@Res() res: Response) {
  res.clearCookie('access_token');
  res.redirect(frontendUrl);
}
```

---

## 데이터 구조

### User (내부)

```typescript
interface User {
  githubId: string;
  username: string;
  avatarUrl: string;
  accessToken: string;  // GitHub API 호출용
}
```

### UserInfo (API 응답)

```typescript
interface UserInfo {
  githubId: string;
  username: string;
  avatarUrl: string;
  // accessToken 미포함 (보안)
}
```

### JWT Payload

```typescript
interface JwtPayload {
  sub: string;      // githubId
  username: string;
}
```

---

## JWT 처리

### REST API (JwtGuard)

쿠키에서 JWT 추출 → 검증 → UserStore에서 사용자 조회

```typescript
// jwt.strategy.ts
jwtFromRequest: ExtractJwt.fromExtractors([
  (req: Request) => req?.cookies?.access_token
]),
```

### WebSocket (WsJwtGuard)

handshake 시 쿠키에서 JWT 검증

```typescript
// ws-jwt.guard.ts
verifyClient(client: Socket): boolean {
  const cookies = client.handshake.headers?.cookie;
  const token = cookies.match(/access_token=([^;]+)/)?.[1];
  const payload = this.jwtService.verify<JwtPayload>(token);
  const user = this.userStore.findByGithubId(payload.sub);
  client.data = { user };
  return true;
}
```

---

## UserStore

인메모리 사용자 저장소 (세션 유지)

```typescript
class UserStore {
  private users = new Map<string, User>();  // githubId -> User

  findOrCreate(user: User): User;
  findByGithubId(githubId: string): User | undefined;
}
```

> **Note:** 서버 재시작 시 UserStore 초기화됨. 사용자는 재로그인 필요.

---

## 보안 고려사항

### httpOnly 쿠키

- JavaScript에서 접근 불가 (XSS 방지)
- 자동으로 모든 요청에 포함

### sameSite: 'lax'

- CSRF 기본 보호
- 동일 사이트 요청에만 쿠키 전송

### scope: ['repo']

- private 레포지토리 접근 권한
- GitHub 활동 감지에 필요

---

## 시퀀스 다이어그램

```
Browser          Frontend         Backend           GitHub
   |                |                |                |
   |--- 로그인 클릭 -->|                |                |
   |                |-- /auth/github ->|                |
   |                |                |-- OAuth 시작 --->|
   |<---------------- GitHub 로그인 페이지 --------------|
   |                |                |                |
   |--- 인증 완료 ---------------------------------->|
   |                |                |<- callback ----|
   |                |                |                |
   |                |                |  JWT 생성      |
   |                |                |  쿠키 설정      |
   |<-- /auth/callback 리다이렉트 ---|                |
   |                |                |                |
   |                |-- /auth/me --->|                |
   |                |<-- UserInfo ---|                |
   |                |                |                |
```
