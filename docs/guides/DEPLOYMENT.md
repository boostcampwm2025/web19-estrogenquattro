# 배포 가이드

## 배포 아키텍처

```
[Frontend Build]          [Backend Server]
Next.js SSG export  -->   NestJS 정적 서빙
(backend/public/)         (포트 8080)
```

프론트엔드는 **정적 빌드** 후 백엔드가 서빙하므로 별도 프론트엔드 서버 불필요

---

## 사전 요구사항

- Node.js 20+
- pnpm 9.12.3+
- PM2 (전역 설치)

```bash
npm install -g pm2
```

---

## 배포 단계

### 1. 환경변수 설정

**backend/.env** 또는 **backend/.env.local**:

```env
GITHUB_CLIENT_ID=production_client_id
GITHUB_CLIENT_SECRET=production_client_secret
JWT_SECRET=production_secure_secret_at_least_32_chars
FRONTEND_URL=https://your-domain.com
GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback
PORT=8080
```

### 2. 빌드

```bash
# 루트에서 전체 빌드
pnpm build:all
```

이 명령은:
1. `backend/dist/` - NestJS 컴파일 결과
2. `backend/public/` - Next.js 정적 빌드 결과

### 3. 데이터베이스 마이그레이션

```bash
cd backend
pnpm migration:run
```

### 4. PM2로 실행

```bash
# 루트에서
pnpm deploy
```

또는 수동으로:

```bash
pm2 start ecosystem.config.js --only backend
```

---

## PM2 설정

**ecosystem.config.js**:

```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
    }
  ]
}
```

### PM2 명령어

| 명령어 | 설명 |
|--------|------|
| `pm2 start ecosystem.config.js` | 시작 |
| `pm2 stop backend` | 중지 |
| `pm2 restart backend` | 재시작 |
| `pm2 reload backend` | 무중단 재시작 |
| `pm2 logs backend` | 로그 확인 |
| `pm2 monit` | 모니터링 대시보드 |
| `pm2 delete backend` | 프로세스 삭제 |

---

## 재배포

### 전체 재배포 (코드 변경 시)

```bash
pnpm deploy:reload
```

이 명령은:
1. `git pull`
2. 의존성 재설치
3. 전체 빌드
4. PM2 재시작

### 빠른 재시작 (설정 변경만)

```bash
pm2 reload backend
```

---

## 정적 파일 서빙

NestJS가 `backend/public/` 폴더를 자동 서빙:

- `GET /` → `index.html`
- `GET /login` → `login.html`
- `GET /_next/static/*` → Next.js 정적 에셋

### Next.js 빌드 설정

**frontend/next.config.ts**:

```typescript
const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: isProd ? 'export' : undefined,
  distDir: isProd ? '../backend/public' : '.next',
};
```

---

## 모니터링

### Prometheus 메트릭

```
GET /metrics
```

### PM2 모니터링

```bash
pm2 monit
```

### 로그 위치

- PM2 로그: `~/.pm2/logs/`
- SQLite DB: `backend/data/jandi.sqlite`

---

## 트러블슈팅

### 포트 충돌

```bash
# 8080 포트 사용 중인 프로세스 확인
lsof -i :8080

# PM2 프로세스 전체 삭제
pm2 delete all
```

### 빌드 실패

```bash
# 캐시 정리 후 재빌드
rm -rf backend/dist backend/public frontend/.next
pnpm build:all
```

### 데이터베이스 초기화

```bash
# SQLite 파일 삭제 후 마이그레이션
rm backend/data/jandi.sqlite
cd backend && pnpm migration:run
```
