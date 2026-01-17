# 개발 환경 설정

## 사전 요구사항

- **Node.js** 20 이상
- **pnpm** 9.12.3+
- **GitHub OAuth App** (개발용)

---

## 프로젝트 구조

```
.
├── backend/          # NestJS 백엔드
├── frontend/         # Next.js 프론트엔드
├── docs/             # 문서
├── ecosystem.config.js
└── package.json      # 루트 스크립트
```

---

## 초기 설정

### 1. 의존성 설치

```bash
# 루트에서 전체 설치
pnpm install:all

# 또는 개별 설치
cd backend && pnpm install
cd frontend && pnpm install
```

### 2. 환경변수 설정

**backend/.env.local** 생성:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
JWT_SECRET=your_jwt_secret_key_must_be_at_least_32_characters_long
FRONTEND_URL=http://localhost:3000
```

> GitHub OAuth App 생성: Settings → Developer settings → OAuth Apps → New OAuth App
> - Homepage URL: `http://localhost:3000`
> - Callback URL: `http://localhost:8080/auth/github/callback`

### 3. 데이터베이스 마이그레이션

```bash
cd backend
pnpm migration:run
```

---

## 개발 서버 실행

### 방법 1: 개별 실행 (추천)

터미널 2개 필요:

```bash
# 터미널 1: Backend (포트 8080)
cd backend
pnpm start:dev

# 터미널 2: Frontend (포트 3000)
cd frontend
pnpm dev
```

### 방법 2: PM2 사용

```bash
# 루트에서
pnpm start
pnpm logs  # 로그 확인
```

---

## 주요 스크립트

### 루트 (package.json)

| 스크립트 | 설명 |
|---------|------|
| `pnpm install:all` | backend/frontend 의존성 설치 |
| `pnpm build:all` | backend/frontend 빌드 |
| `pnpm start` | PM2로 전체 실행 |
| `pnpm logs` | PM2 로그 확인 |

### Backend (backend/package.json)

| 스크립트 | 설명 |
|---------|------|
| `pnpm start:dev` | 개발 서버 (watch 모드) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm lint` | ESLint 검사 |
| `pnpm lint:fix` | ESLint 자동 수정 |
| `pnpm format` | Prettier 검사 |
| `pnpm format:fix` | Prettier 자동 수정 |
| `pnpm test` | Jest 테스트 |
| `pnpm migration:run` | 마이그레이션 실행 |
| `pnpm migration:generate` | 마이그레이션 생성 |

### Frontend (frontend/package.json)

| 스크립트 | 설명 |
|---------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 정적 빌드 (backend/public으로 출력) |
| `pnpm lint` | ESLint 검사 |
| `pnpm format` | Prettier 검사 |
| `pnpm format:fix` | Prettier 자동 수정 |

---

## 개발 포트

| 서비스 | 개발 포트 | 비고 |
|--------|----------|------|
| Frontend | 3000 | Next.js dev server |
| Backend | 8080 | NestJS + Socket.io |

---

## 코드 스타일

### ESLint + Prettier

```bash
# 린트 검사
cd backend && pnpm lint
cd frontend && pnpm lint

# 포맷팅
cd backend && pnpm format:fix
cd frontend && pnpm format:fix
```

### 권장 VSCode 확장

- ESLint
- Prettier
- TypeScript Importer

---

## 디버깅

### Backend 디버그 모드

```bash
cd backend
pnpm start:debug
```

VSCode에서 `Attach to Node Process` 디버거 연결

### 로그 확인

```bash
# PM2 로그
pnpm logs

# 또는 직접 실행 시 콘솔 출력 확인
```
