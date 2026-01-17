# REST API 엔드포인트

## Base URL

```
개발: http://localhost:8080
```

---

## 인증 (Auth)

### GitHub 로그인 시작

```
GET /auth/github
```

GitHub OAuth 로그인 페이지로 리다이렉트

**Response:** 302 Redirect to GitHub

---

### GitHub OAuth 콜백

```
GET /auth/github/callback
```

GitHub에서 인증 완료 후 호출되는 콜백

**Response:**
- Set-Cookie: `access_token` (httpOnly, JWT)
- 302 Redirect to `/auth/callback`

---

### 현재 사용자 정보 조회

```
GET /auth/me
```

**Headers:**
```
Cookie: access_token=<JWT>
```

**Response:**
```json
{
  "githubId": "12345678",
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345678"
}
```

**Error:**
- 401 Unauthorized: 토큰 없음 또는 만료

---

### 로그아웃

```
GET /auth/logout
```

**Response:**
- Clear-Cookie: `access_token`
- 302 Redirect to Frontend

---

## 메트릭 (Monitoring)

### Prometheus 메트릭

```
GET /metrics
```

Prometheus 형식의 메트릭 데이터

**Response:**
```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 0.1234
...
```

---

## 정적 파일 서빙

### Frontend 정적 파일

```
GET /*
```

`/api/*`, `/auth/*`, `/socket.io/*`, `/metrics/*`를 제외한 모든 경로는 `backend/public` 폴더의 정적 파일 서빙

**예시:**
- `GET /` → `backend/public/index.html`
- `GET /login` → `backend/public/login.html`
- `GET /_next/static/...` → Next.js 정적 에셋
