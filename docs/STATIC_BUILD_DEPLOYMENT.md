# Frontend 정적 빌드 및 백엔드 서빙 마이그레이션

## 📋 개요

Next.js 프론트엔드를 정적 파일로 빌드하고, NestJS 백엔드에서 서빙하도록 변경한 작업의 전체 과정을 문서화합니다.

**작성일**: 2026-01-10
**상태**: 구현 완료 (정적 서빙/CORS/프로필 이미지 CORS 해결)

---

## 🎯 목표

- Next.js 프론트엔드를 정적 HTML/CSS/JS로 빌드
- 단일 NestJS 서버에서 프론트엔드와 백엔드 모두 서빙
- 서버 리소스 최적화 (Next.js 서버 불필요)

---

## 🔍 초기 조사

### 1. Next.js 정적 빌드 가능성 확인

**결론**: ✅ 가능

Next.js는 `output: 'export'` 옵션으로 정적 빌드를 지원합니다.

### 2. 현재 코드베이스에서 사용 불가능한 기능 조사

#### ❌ 사용 불가능 (정적 빌드 시)

1. **Next.js API Routes**
   - 위치: `src/app/api/github-profile/[username]/route.ts`
   - 역할: GitHub 프로필 이미지 프록시 (CORS 우회 + 캐싱)
   - 사용 위치:
     - `src/game/scenes/MapScene.ts:96` - 본인 프로필 이미지
     - `src/game/scenes/MapScene.ts:516` - 다른 플레이어 프로필 이미지

2. **런타임 Headers 설정**
   - 위치: `next.config.ts:13-26`
   - `async headers()` 함수는 서버 사이드 기능
   - 정적 빌드에서 동작하지 않음

#### ✅ 사용 가능

- Google Fonts (`next/font/google`) - 빌드 시 최적화되어 포함됨
- 환경 변수 (`NEXT_PUBLIC_*`) - 빌드 시 번들에 포함됨
- Socket.io, Phaser, Zustand, React Query 등 모든 클라이언트 사이드 기능
- `"use client"` 컴포넌트 전체

---

## 💡 검토한 해결 방법들

### 방법 1: API Route를 백엔드(NestJS)로 이전

**구현**:
- NestJS에 `/api/github-profile/:username` 엔드포인트 구현
- 프론트엔드에서 `NEXT_PUBLIC_API_URL + '/api/github-profile/' + username` 호출

**장점**:
- ✅ 아키텍처적으로 가장 깔끔함 (API는 백엔드의 역할)
- ✅ CORS 문제 완전 해결
- ✅ 캐싱 전략 통합 관리 (Redis, 메모리 캐시)
- ✅ 인증/권한 관리 용이
- ✅ 로깅, 모니터링 통합

**단점**:
- ❌ 백엔드 코드 작성 필요
- ❌ 초기 구현 시간 소요 (30분~1시간)

**적합성**: 프로덕션 환경, 장기 유지보수

---

### 방법 2: GitHub 이미지 직접 로드 ⭐⭐⭐⭐⭐ (선택됨)

**구현**:
```typescript
this.load.image("face", `https://avatars.githubusercontent.com/${username}`);
```
> `https://github.com/{username}.png`는 브라우저에서 CORS 헤더가 없어 차단되므로 `avatars.githubusercontent.com`을 사용합니다.

**장점**:
- ✅ 가장 간단함 (코드 1줄 수정)
- ✅ 구현 시간 최소 (5분)
- ✅ 서버 리소스 사용 안 함
- ✅ GitHub CDN 직접 활용

**단점 (예상)**:
- ⚠️ CORS 문제 가능성 (github.com 도메인 사용 시 차단)
- ⚠️ Phaser crossOrigin 설정 필요
- ⚠️ GitHub API Rate Limit 가능성
- ⚠️ 캐싱 제어 불가
- ⚠️ GitHub 서비스 장애 시 영향
- ⚠️ 네트워크 에러 처리 복잡

**적합성**: MVP, 프로토타입, 빠른 배포

---

### 방법 3: 빌드 시 이미지 사전 다운로드

**구현**: 빌드 스크립트로 알려진 사용자 이미지를 `/public`에 저장

**장점**:
- ✅ CORS 문제 완전 해결
- ✅ 로딩 속도 빠름

**단점**:
- ❌ 신규 사용자 이미지 로드 불가 (치명적)
- ❌ 동적 사용자 시스템에 부적합

**적합성**: 사용자 목록이 고정된 경우만

---

## 🔬 방법 2 단점 검증 (실제 테스트)

### 검증 1: CORS 문제 → ✅ **해결됨 (github.com 도메인은 실패)**

**테스트**:
- 브라우저에서 `https://github.com/{username}.png` 요청 → CORS 차단
- `https://avatars.githubusercontent.com/u/221258485?v=4`
  ```bash
  curl -I https://avatars.githubusercontent.com/u/221258485?v=4
  ```

**결과**:
```
access-control-allow-origin: *
```

**결론**: `github.com/{username}.png`는 브라우저에서 CORS 차단되므로 `avatars.githubusercontent.com`으로 변경.

**원인 분석**:
- `github.com` 웹 도메인은 `Access-Control-Allow-Origin` 헤더가 없어 브라우저가 차단
- `avatars.githubusercontent.com`은 CORS 허용 헤더가 있어 정상 로드
- Phaser `load.image`는 XHR/Fetch 기반이라 CORS 규칙을 그대로 적용받음

---

### 검증 2: Phaser crossOrigin 설정 → ✅ **이미 완료됨**

**현재 코드** (MapScene.ts:78):
```typescript
this.load.crossOrigin = "anonymous";
```

**결론**: 이미 설정되어 있어 추가 작업 불필요.

---

### 검증 3: GitHub API Rate Limit → ✅ **거의 거짓**

**테스트**:
```bash
# 연속 5회 요청
for i in {1..5}; do curl -s -o /dev/null -w "%{http_code}\n" https://avatars.githubusercontent.com/u/221258485; done
```

**결과**: 모두 200 OK

**GitHub 공식 정책**:
- avatars.githubusercontent.com은 **rate limit 없음**
- 출처: [GitHub Discussion #147297](https://github.com/orgs/community/discussions/147297)
- 2025년 5월 업데이트: 인증 없는 요청에 제한 있지만, avatars는 제외

**결론**: 일반적인 사용량에서 문제 없음.

---

### 검증 4: 캐싱 제어 → ⚠️ **부분적 거짓**

**테스트**:
```bash
curl -I https://avatars.githubusercontent.com/u/221258485?v=4 | grep cache
```

**결과**:
```
cache-control: max-age=300  # 5분 캐싱
etag: "d8d6b5af5ea10fb0cb75b2f9b839283d501c6262c2ada6c17b88ad7be44b579b"
```

**결론**:
- GitHub가 5분 캐싱 제공
- 브라우저 캐싱 자동 적용
- 서버 측 캐싱은 불가하지만 클라이언트에서 충분

---

### 검증 5: GitHub 서비스 장애 → ❌ **사실 (낮은 확률)**

**결론**:
- GitHub CDN 가용성: 99.9%+ (매우 안정적)
- 게임 진행에는 영향 없음 (이미지만 안 보임)
- 치명적이지 않음

---

### 검증 6: 네트워크 에러 처리 → ⚠️ **부분적 사실**

**결론**:
- 현재 API Route도 에러 처리 안 함
- Phaser가 이미지 로드 실패 시 자동 fallback
- 추가 작업 최소

---

## 🎯 의사결정: 방법 2 선택

**선택 이유**:
1. 실제 테스트 결과 **예상 단점들이 거의 발생하지 않음**
2. 구현 시간 최소 (5분)
3. 서버 리소스 절약
4. GitHub CDN의 높은 안정성
5. 프로젝트 성격상 (MVP, 게임) 충분히 실용적

**재평가 결과**:

| 단점 | 원래 평가 | 실제 검증 | 심각도 |
|------|----------|----------|--------|
| CORS 문제 | ❌ | ⚠️ github.com 도메인 실패, avatars OK | 낮음 |
| crossOrigin 설정 | ⚠️ | ✅ 이미 완료 | 없음 |
| Rate Limit | ❌ | ✅ avatars는 제외 | 매우 낮음 |
| 캐싱 제어 | ⚠️ | ⚠️ 브라우저 캐싱 OK | 낮음 |
| GitHub 장애 | ❌ | ❌ 가능 (확률 낮음) | 낮음 |
| 에러 처리 | ⚠️ | ⚠️ 현재와 동일 | 낮음 |

---

## ✅ 완료된 작업

### 1. next.config.ts 수정

**파일**: `frontend/next.config.ts`

**변경 내용**:
```typescript
// 변경 전
const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => { /* ... */ },
  async headers() {
    return [
      {
        source: "/github-image/:path*",
        headers: [/* CORS headers */],
      },
    ];
  },
};

// 변경 후
const nextConfig: NextConfig = {
  output: 'export',  // 정적 빌드 활성화
  webpack: (config) => { /* ... */ },
  // headers() 제거 (정적 빌드에서 불필요)
};
```

---

### 2. MapScene.ts 수정 (2곳)

**파일**: `frontend/src/game/scenes/MapScene.ts`

**변경 1** (라인 96): 본인 프로필 이미지
```typescript
// 변경 전
this.load.image("face", `/api/github-profile/${username}`);

// 변경 후
this.load.image("face", `https://avatars.githubusercontent.com/${username}`);
```

**변경 2** (라인 516): 다른 플레이어 프로필 이미지
```typescript
// 변경 전
const imageUrl = `/api/github-profile/${username}`;

// 변경 후
const imageUrl = `https://avatars.githubusercontent.com/${username}`;
```

---

### 3. API Route 삭제

**삭제된 디렉토리**: `frontend/src/app/api/`

더 이상 필요하지 않은 GitHub 프로필 프록시 API Route를 제거했습니다.

---

### 4. 정적 빌드 성공 (초기 테스트)

**빌드 명령**:
```bash
cd frontend
pnpm build
```

**빌드 결과**:
- ✅ 빌드 성공 (경고 없음)
- 📦 빌드 크기: 5.5MB
- 📁 출력 위치: `frontend/out/`
- ⏱️ 빌드 시간: ~15초

---

### 5. distDir 설정 (백엔드 직접 빌드)

**파일**: `frontend/next.config.ts`

**변경 내용**:
```typescript
const nextConfig: NextConfig = {
  output: 'export',
  distDir: '../backend/public',  // 백엔드로 직접 빌드
  webpack: (config) => { /* ... */ },
};
```

**추가 설정**: `backend/.gitignore`
```gitignore
# Frontend static files (built by Next.js)
/public
```

**테스트 빌드**:
```bash
cd frontend
pnpm build
```

**빌드 결과**:
- ✅ 빌드 성공
- 📁 출력 위치: `backend/public/`
- ✅ `.gitignore`에 추가하여 빌드 결과물이 Git에 포함되지 않음

**빌드 결과물 구조**:
```
out/
├── index.html          # 메인 페이지 (게임)
├── login/              # 로그인 페이지
│   └── index.html
├── auth/callback/      # OAuth 콜백 페이지
│   └── index.html
├── assets/             # 게임 에셋
│   ├── body.png
│   ├── tempMap1.png
│   ├── tempMap2.png
│   ├── temp1Tilemap.json
│   └── temp2Tilemap.json
├── _next/              # Next.js 번들 파일
│   ├── static/
│   │   ├── chunks/
│   │   ├── css/
│   │   └── media/
│   └── [build-id]/
├── fonts/              # Google Fonts
└── favicon.ico
```

**라우팅 정보**:
```
Route (app)
┌ ○ /                  # 메인 게임 페이지
├ ○ /_not-found        # 404 페이지
├ ○ /auth/callback     # OAuth 콜백
└ ○ /login             # 로그인 페이지

○ (Static) prerendered as static content
```

---

### 6. NestJS 정적 파일 서빙 설정

**파일**: `backend/src/app.module.ts`

**변경 내용**:
```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public'),
  exclude: [
    '/api/*path',
    '/auth/github/*path',
    '/auth/me',
    '/auth/logout',
    '/socket.io/*path',
    '/metrics/*path',
  ],
}),
```

---

### 7. FRONTEND_URL/CORS 정리

**파일**:
- `backend/src/config/env.validation.ts`
- `backend/src/main.ts`
- `backend/src/player/player.gateway.ts`
- `backend/.env.local`

**변경 내용**:
- `FRONTEND_URL` 기본값을 `http://localhost:8080`으로 변경
- `FRONTEND_URL`을 콤마(`,`)로 분리해 CORS 허용 origin 목록으로 사용
- 로컬 환경에 `FRONTEND_URL=http://localhost:8080` 추가

---

### 8. 정적 서빙 의존성 추가

**파일**: `backend/package.json`

**변경 내용**:
```json
"@nestjs/serve-static": "^5.0.4"
```
- NestJS 11과 호환되는 최신 버전 사용

---

## 📋 앞으로 해야 할 일

> **중요**: 아래 단계들은 여러 방법 중 하나를 선택해야 합니다. 각 방법의 장단점을 확인하고 프로젝트에 맞는 방법을 선택하세요.

---

### 1. 백엔드 정적 파일 서빙 설정 (완료)

NestJS에서 프론트엔드 정적 파일을 서빙하도록 설정해야 합니다.

**현재 상태**:
- ✅ `distDir: '../backend/public'` 설정 완료 (옵션 B 선택됨)
- ✅ `ServeStaticModule` 설정 완료
- ✅ `@nestjs/serve-static` 의존성 추가

#### ~~옵션 A: 빌드 결과를 백엔드로 복사~~

**장점**:
- 프론트엔드와 백엔드 빌드 분리
- 각각 독립적으로 빌드 가능
- CI/CD 파이프라인 구성 용이

**구현 방법**:

1. **수동 복사** (개발/테스트용):
   ```bash
   cp -r frontend/out/* backend/public/
   ```

2. **빌드 스크립트** (프로덕션용):

   `backend/package.json`:
   ```json
   {
     "scripts": {
       "build:frontend": "cd ../frontend && pnpm build && cp -r out/* ../backend/public/",
       "build:all": "pnpm build:frontend && pnpm build"
     }
   }
   ```

3. **NestJS 설정**:

   설치:
   ```bash
   cd backend
   pnpm add @nestjs/serve-static
   ```

   `backend/src/app.module.ts`:
   ```typescript
   import { Module } from '@nestjs/common';
   import { ServeStaticModule } from '@nestjs/serve-static';
   import { join } from 'path';

   @Module({
     imports: [
       ServeStaticModule.forRoot({
         rootPath: join(__dirname, '..', 'public'),
         exclude: [
           '/api/*path',
           '/auth/github/*path',
           '/auth/me',
           '/auth/logout',
           '/socket.io/*path',
           '/metrics/*path',
         ],
       }),
       // 다른 모듈들...
     ],
   })
   export class AppModule {}
   ```

---

#### 옵션 B: Next.js가 직접 백엔드로 빌드 ✅ 선택됨

**장점**:
- 복사 과정 불필요
- 빌드 한 번으로 완료

**단점**:
- 프론트엔드와 백엔드 빌드 결합
- 프론트엔드 빌드가 백엔드 파일을 덮어쓸 위험

**구현 방법**: ✅ 완료

`frontend/next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  output: 'export',
  distDir: '../backend/public',  // 백엔드로 직접 빌드
  webpack: (config) => { /* ... */ },
};
```

**주의사항**: ✅ 완료
- `backend/public/` 폴더가 Git에 포함되지 않도록 `.gitignore` 설정 필요
- 백엔드 빌드 전에 프론트엔드 빌드 필수

**테스트 방법**:
```bash
cd frontend
pnpm build
ls -la ../backend/public  # 빌드 파일 확인
```

**예상 결과**:
- `backend/public/` 폴더에 `index.html`, `_next/`, `assets/` 등 생성됨

---

#### NestJS 서빙 설정 (완료)

**적용 내용**:
- `@nestjs/serve-static` 추가 (v5.0.4)
- `backend/src/app.module.ts`에 정적 서빙 설정 추가

```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public'),
  exclude: [
    '/api/*path',
    '/auth/github/*path',
    '/auth/me',
    '/auth/logout',
    '/socket.io/*path',
    '/metrics/*path',
  ],
}),
```

**테스트 방법**:
```bash
# 백엔드 서버 실행
cd backend
pnpm start:dev

# 브라우저에서 확인
# http://localhost:8080/ → 프론트엔드 메인 페이지 (게임)
# http://localhost:8080/login → 로그인 페이지
```

**예상 결과**:
- `http://localhost:8080/` → Next.js 게임 화면 표시
- `http://localhost:8080/api/*` → NestJS API 응답
- `http://localhost:8080/auth/*` → NestJS OAuth 처리

**문제 발생 시 체크리스트**:
- [ ] `backend/public/` 폴더에 빌드 파일이 있는지 확인
- [ ] `exclude` 옵션에 `/api/*path`, `/auth/github/*path`, `/auth/me`, `/auth/logout`, `/socket.io/*path`, `/metrics/*path`가 포함되어 있는지 확인
- [ ] `rootPath` 경로가 올바른지 확인 (`join(__dirname, '..', 'public')`)

---

### 2. 라우팅 우선순위 설정 (완료)

**목적**: 백엔드 API와 프론트엔드 라우팅이 충돌하지 않도록 우선순위를 명확히 설정

**권장 구조**:
- `/api/*` → 백엔드 API (NestJS) - 우선 처리
- `/auth/*` → 백엔드 OAuth (NestJS) - 우선 처리
- `/socket.io/*` → Socket.io (NestJS) - 우선 처리
- `/*` → 프론트엔드 정적 파일 (Next.js) - 마지막 처리

**설정 방법**: `ServeStaticModule`의 `exclude` 옵션으로 명시 적용
```typescript
exclude: [
  '/api/*path',
  '/auth/github/*path',
  '/auth/me',
  '/auth/logout',
  '/socket.io/*path',
  '/metrics/*path',
]
```

**테스트 방법**:
```bash
# API 테스트
curl http://localhost:8080/api/users

# 정적 파일 테스트
curl http://localhost:8080/

# OAuth 테스트
curl http://localhost:8080/auth/github
```

**예상 결과**:
- `/api/users` → JSON 응답
- `/` → HTML 파일 응답
- `/auth/github` → GitHub OAuth 리다이렉트

---

### 3. 환경 변수 확인 (부분 완료)

프론트엔드가 백엔드 API를 올바르게 호출하는지 확인해야 합니다.

**현재 상태**:
- ✅ 백엔드 `FRONTEND_URL` 기본값을 `http://localhost:8080`으로 변경
- ✅ `backend/.env.local`에 `FRONTEND_URL=http://localhost:8080` 추가

**시나리오별 설정**:

#### 시나리오 A: 같은 도메인에서 서빙 (권장)

**설명**: 프론트엔드와 백엔드가 같은 서버(`http://localhost:8080`)에서 서빙

**설정**:
```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080

# backend/.env.local
FRONTEND_URL=http://localhost:8080
```

**장점**:
- CORS 문제 없음 (같은 origin)
- 간단한 설정

**테스트 방법**:
```bash
# 프론트엔드 빌드
cd frontend
pnpm build

# 환경 변수 확인
grep NEXT_PUBLIC_API_URL .env.local

# 백엔드 실행
cd ../backend
pnpm start:dev

# 브라우저에서 http://localhost:8080 접속
# 개발자 도구 → Network 탭에서 API 요청 확인
```

**예상 결과**:
- API 요청: `http://localhost:8080/api/users`
- CORS 에러 없음

---

#### 시나리오 B: 다른 포트에서 개발 (현재 상황 아님)

**설명**: 프론트엔드 개발 서버(`3000`)와 백엔드(`8080`) 분리

**이 시나리오는 정적 빌드를 사용하지 않으므로 해당 없음**

---

#### 시나리오 C: 프로덕션 환경

**설정**:
```env
# frontend/.env.production
NEXT_PUBLIC_API_URL=https://yourdomain.com

# backend/.env.production
FRONTEND_URL=https://yourdomain.com
```

**빌드 시 적용**:
```bash
cd frontend
pnpm build  # .env.production 자동 적용
```

**테스트 방법** (배포 후):
```bash
# 브라우저 개발자 도구에서 API URL 확인
# Network 탭 → API 요청 → Request URL 확인
```

---

### 4. CORS 설정 확인 (완료)

**현재 설정**: `FRONTEND_URL`을 콤마(`,`)로 분리해 CORS 허용 origin 목록으로 사용

```typescript
// backend/src/main.ts
const frontendUrls = configService
  .getOrThrow<string>('FRONTEND_URL')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.enableCors({
  origin: frontendUrls,
  credentials: true,
});
```

**테스트 체크리스트**:
- [ ] 백엔드 서버 실행 (`cd backend && pnpm start:dev`)
- [ ] 브라우저에서 `http://localhost:8080` 접속
- [ ] 개발자 도구 → Console 탭에서 CORS 에러 없는지 확인
- [ ] Network 탭에서 API 요청이 정상적으로 이루어지는지 확인

---

### 5. 배포 설정 (선택사항)

프로덕션 배포 시 고려사항입니다.

#### Nginx 설정 예시 (리버스 프록시 사용 시)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 정적 파일 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:8080;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 요청
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io
    location /socket.io {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 나머지 모든 요청
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔧 통합 테스트 체크리스트

> **중요**: 모든 설정 완료 후 아래 체크리스트를 **순서대로** 테스트해야 합니다.

### Phase 1: 빌드 테스트

- [ ] **프론트엔드 빌드 성공**
  ```bash
  cd frontend
  pnpm build
  ```
  - 에러 없이 빌드 완료
  - `backend/public/` 폴더에 파일 생성 확인

- [ ] **빌드 결과물 확인**
  ```bash
  ls -la backend/public/
  ```
  - `index.html` 존재 확인
  - `_next/` 폴더 존재 확인
  - `assets/` 폴더 존재 확인

---

### Phase 2: 백엔드 서버 실행 테스트

- [ ] **백엔드 서버 시작**
  ```bash
  cd backend
  pnpm start:dev
  ```
  - 에러 없이 서버 실행
  - 포트 8080에서 리스닝 확인

- [ ] **정적 파일 서빙 확인**
  - 브라우저에서 `http://localhost:8080` 접속
  - Next.js 메인 페이지가 표시되는지 확인

---

### Phase 3: 라우팅 테스트

- [ ] **프론트엔드 라우트 테스트**
  - `http://localhost:8080/` → 메인 게임 페이지 표시
  - `http://localhost:8080/login` → 로그인 페이지 표시
  - `http://localhost:8080/auth/callback` → 백엔드 OAuth 처리 (리다이렉트)

- [ ] **백엔드 API 라우트 테스트**
  ```bash
  curl http://localhost:8080/api/users
  ```
  - JSON 응답 확인
  - HTML이 아닌 API 응답 확인

---

### Phase 4: 기능 테스트

- [ ] **GitHub 프로필 이미지 로드**
  - 개발자 도구 → Network 탭 열기
  - 게임 실행
  - `https://avatars.githubusercontent.com/[username]` 요청 확인
  - 이미지 로딩 성공 (200 OK) 확인

- [ ] **Phaser 게임 정상 실행**
  - 게임 화면이 표시되는지 확인
  - 캐릭터 이동 가능한지 확인
  - 콘솔에 에러 없는지 확인

- [ ] **Socket.io 연결**
  - Network 탭에서 WebSocket 연결 확인
  - `ws://localhost:8080/socket.io/` 연결 성공 확인

- [ ] **다른 플레이어 프로필 이미지**
  - 다른 브라우저/시크릿 모드로 접속
  - 두 플레이어의 프로필 이미지 모두 표시되는지 확인

---

### Phase 5: 에러 처리 테스트

- [ ] **404 페이지**
  - `http://localhost:8080/nonexistent` 접속
  - 404 페이지가 표시되는지 확인

- [ ] **CORS 에러 없는지 확인**
  - 개발자 도구 → Console 탭
  - CORS 관련 에러 메시지 없는지 확인

- [ ] **Network 에러 확인**
  - Network 탭에서 모든 요청이 성공하는지 확인
  - 빨간색 에러가 없는지 확인

---

### Phase 6: 성능 테스트 (선택사항)

- [ ] **빌드 크기 확인**
  ```bash
  du -sh backend/public
  ```
  - 예상 크기: 5~6MB

- [ ] **페이지 로딩 속도**
  - 개발자 도구 → Network 탭
  - Disable cache 체크
  - 새로고침 후 로딩 시간 확인

- [ ] **gzip 압축 적용 여부**
  ```bash
  curl -H "Accept-Encoding: gzip" -I http://localhost:8080/_next/static/chunks/main.js
  ```
  - `Content-Encoding: gzip` 헤더 확인

---

### Phase 7: 프로덕션 배포 전 최종 체크

- [ ] **환경 변수 확인**
  - `frontend/.env.production` 파일 확인
  - `NEXT_PUBLIC_API_URL` 값이 프로덕션 도메인인지 확인

- [ ] **프로덕션 빌드**
  ```bash
  cd frontend
  NODE_ENV=production pnpm build
  ```

- [ ] **Git 커밋 전 확인**
  ```bash
  git status
  ```
  - `backend/public/` 폴더가 Git에 포함되지 않는지 확인 (.gitignore 작동 확인)

---

## 📚 참고 자료

### Next.js 공식 문서
- [Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Output File Tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

### NestJS 공식 문서
- [Serve Static](https://docs.nestjs.com/recipes/serve-static)

### GitHub 관련
- [GitHub Discussion #147297 - Avatar URLs](https://github.com/orgs/community/discussions/147297)
- [GitHub Changelog - Rate Limits](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)
- [CORS and raw.githubusercontent.com](https://github.com/orgs/community/discussions/69281)

---

## 📝 추가 고려사항

### 향후 확장 가능성

만약 방법 2로 인한 문제가 발생하거나, 더 나은 성능이 필요한 경우:

1. **방법 1로 마이그레이션**:
   - NestJS에 `/api/github-profile/:username` 구현
   - Redis 캐싱 추가
   - 프론트엔드 코드 2줄만 수정하면 됨

2. **이미지 최적화**:
   - NestJS에서 이미지 리사이징/압축
   - WebP 변환
   - CDN 활용

3. **Fallback 전략**:
   - GitHub 이미지 로드 실패 시 기본 아바타 표시
   - 에러 로깅 및 모니터링

---

## 🔄 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-01-10 | 초안 작성, 방법 2 구현 완료 | - |
| 2026-01-10 | distDir 설정 추가, 테스트 체크리스트 상세화 | - |
| 2026-01-10 | 단계별 선택 옵션 및 테스트 방법 추가 | - |
| 2026-01-10 | NestJS 정적 서빙/CORS/FRONTEND_URL 설정 반영 | - |
| 2026-01-10 | 프로필 이미지 URL을 avatars.githubusercontent.com으로 변경 | - |

---

## ✅ 승인 및 리뷰

- [ ] 팀 리뷰 완료
- [ ] 테스트 완료
- [ ] 배포 승인
