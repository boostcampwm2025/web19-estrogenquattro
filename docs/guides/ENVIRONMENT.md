# 환경변수 설정

## 개요

환경변수는 `backend/.env.local` 파일에 설정하며, Joi로 검증됨

---

## 필수 환경변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | `Ov23lijBULRQ7BXNW0W3` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | `your_secret_here` |
| `JWT_SECRET` | JWT 서명 키 (최소 32자) | `your_jwt_secret_key_must_be_at_least_32_characters` |

---

## 선택 환경변수 (기본값 있음)

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PORT` | `8080` | 서버 포트 |
| `FRONTEND_URL` | `http://localhost:8080` | 프론트엔드 URL (리다이렉트용) |
| `GITHUB_CALLBACK_URL` | `http://localhost:8080/auth/github/callback` | OAuth 콜백 URL |
| `ASSETS_PATH` | `__dirname` 기반 | 맵 에셋 경로 (미설정 시 `backend/assets/`) |

---

## 설정 파일 예시

**backend/.env.local:**

```env
# 필수
GITHUB_CLIENT_ID=Ov23lijBULRQ7BXNW0W3
GITHUB_CLIENT_SECRET=your_github_client_secret_here
JWT_SECRET=your_jwt_secret_key_must_be_at_least_32_characters_long

# 선택 (기본값 사용 시 생략 가능)
PORT=8080
FRONTEND_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback
```

---

## 환경변수 검증

**backend/src/config/env.validation.ts:**

```typescript
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // 필수
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),

  // 선택 (기본값)
  PORT: Joi.number().default(8080),
  FRONTEND_URL: Joi.string()
    .pattern(/^[^,]+$/)
    .default('http://localhost:8080'),
  GITHUB_CALLBACK_URL: Joi.string().default(
    'http://localhost:8080/auth/github/callback',
  ),
});
```

---

## GitHub OAuth App 설정

### 1. OAuth App 생성

1. GitHub → Settings → Developer settings → OAuth Apps
2. "New OAuth App" 클릭
3. 정보 입력:
   - **Application name:** 원하는 이름
   - **Homepage URL:** `http://localhost:3000` (개발) 또는 실제 도메인
   - **Authorization callback URL:** `http://localhost:8080/auth/github/callback`

### 2. Client ID/Secret 복사

생성된 앱에서 Client ID와 Client Secret을 복사하여 `.env.local`에 설정

---

## 환경별 설정

### 개발 환경

```env
FRONTEND_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback
```

### 프로덕션 환경

```env
FRONTEND_URL=https://your-domain.com
GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback
```

> **Note:** 프로덕션에서는 HTTPS 사용 권장. 쿠키 설정의 `secure: true`도 함께 변경 필요.

---

## 주의사항

### JWT_SECRET

- 최소 32자 이상
- 프로덕션에서는 복잡한 랜덤 문자열 사용
- 노출 시 모든 JWT가 무효화되어야 함

### GITHUB_CLIENT_SECRET

- 절대 Git에 커밋하지 않음
- `.gitignore`에 `.env.local` 포함 확인

### 환경변수 누락 시

서버 시작 시 Joi 검증 실패로 에러 발생:

```
Error: Config validation error: "GITHUB_CLIENT_ID" is required
```
