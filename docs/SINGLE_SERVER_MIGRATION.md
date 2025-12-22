# 단일 서버 마이그레이션 계획

Next.js + NestJS (2 프로세스) 구조를 React + Express (1 프로세스) 구조로 마이그레이션하여 VM.Standard.E2.1.Micro 환경에서 운영하기 위한 계획입니다.

---

## 목차

1. [개요](#1-개요)
2. [Git 브랜치 전략](#2-git-브랜치-전략)
3. [현재 아키텍처 분석](#3-현재-아키텍처-분석)
4. [목표 아키텍처](#4-목표-아키텍처)
5. [리소스 분석](#5-리소스-분석)
6. [마이그레이션 단계별 계획](#6-마이그레이션-단계별-계획)
7. [프론트엔드 상세 마이그레이션](#7-프론트엔드-상세-마이그레이션)
8. [백엔드 상세 마이그레이션](#8-백엔드-상세-마이그레이션)
9. [통합 및 배포](#9-통합-및-배포)

---

## 1. 개요

### 1.1 배경

| 항목 | 현재 | 목표 |
|------|------|------|
| 프론트엔드 | Next.js 16 (SSR) | React + Vite (SPA) |
| 백엔드 | NestJS 11 | Express |
| 프로세스 | 2개 (Frontend + Backend) | 1개 (통합 서버) |
| 정적 파일 | Next.js 서버 | Express static 미들웨어 |

### 1.2 타겟 환경

| 항목 | 값 |
|------|-----|
| 인스턴스 | Oracle Cloud VM.Standard.E2.1.Micro |
| CPU | 1/8 OCPU (공유 코어) |
| 메모리 | 1 GB |
| 네트워크 | 최대 480 Mbps |
| 목표 동시 접속자 | **50명** |

### 1.3 마이그레이션 이점

- **메모리 절약**: Next.js 서버 제거로 ~100-200MB 절약
- **단순화**: 단일 프로세스로 관리 용이
- **빌드 크기 감소**: SSR 관련 코드 제거
- **시작 시간 단축**: 하나의 프로세스만 부팅

---

## 2. Git 브랜치 전략

### 2.1 전략 개요: "Parallel Migration"

**deploy/test-all-prs 브랜치에서 분기하여 기존 코드(frontend/, backend/)를 참조하면서 새 구조(client/, server/)를 병렬로 생성합니다.**

| 단계 | 폴더 구조 | 설명 |
|------|-----------|------|
| 분기 직후 | frontend/, backend/ | 기존 코드 그대로 |
| Phase 1 완료 | frontend/, backend/, **client/** | 새 프론트엔드 추가 |
| Phase 2 완료 | frontend/, backend/, client/, **server/** | 새 백엔드 추가 |
| Phase 3 완료 | ~~frontend/~~, ~~backend/~~, client/, server/ | 기존 폴더 삭제 |

**장점:**
- 기존 코드를 직접 참조 가능 (같은 브랜치에 있음)
- **테스트 포인트 A**: 새 client/를 기존 backend/와 연동 테스트 가능
- 마이그레이션 실패 시 기존 폴더로 즉시 롤백 가능

### 2.2 분기 지점

**deploy/test-all-prs 브랜치 사용 이유:** main에 아직 머지되지 않은 중요 기능들이 포함되어 있음

| 기능 | 설명 |
|------|------|
| 중복 접속 방지 | 새 탭 접속 시 이전 세션 종료 + 오버레이 표시 |
| 새로고침 시 상태 복원 | 게이지바, 기여리스트, 접속시간 유지 |
| GitHub GraphQL API | REST API 캐시 문제 해결 |
| 폴링 기준점 유지 | 새로고침해도 기준점 보존 |

```bash
# 분기 지점 확인
git log deploy/test-all-prs --oneline -5

# 결과:
# 4ed5244 Merge remote-tracking branch 'origin/feat/#55-prevent-duplicate-session'
# 53b18c4 Merge remote-tracking branch 'origin/feat/#49-restore-state-on-refresh'
# 0537909 feat: GitHub GraphQL API로 전환 (REST API 캐시 문제 해결)
# f22161e feat: 다른 탭 접속 시 이전 탭에 세션 종료 오버레이 표시
# dc277ba feat: 새로고침 시 같은 방 모든 사용자 접속시간 동기화
```

### 2.3 브랜치 구조

```
deploy/test-all-prs (4ed5244) ← 분기 지점 (최신 기능 포함)
    │
    └── feat/single-server-migration
          │
          │   [마이그레이션 진행 중 폴더 구조]
          │   ├── frontend/    (기존 - 참조용, 테스트용, 최종 삭제)
          │   ├── backend/     (기존 - 참조용, 테스트용, 최종 삭제)
          │   ├── client/      (새로 생성 - React + Vite)
          │   ├── server/      (새로 생성 - Express)
          │   └── docs/
          │
          └── [최종 폴더 구조]
                ├── client/
                ├── server/
                └── docs/
```

### 2.4 브랜치 생성

```bash
# deploy/test-all-prs 브랜치로 이동
git checkout deploy/test-all-prs
git pull origin deploy/test-all-prs

# 마이그레이션 브랜치 생성
git checkout -b feat/single-server-migration

# 원격에 브랜치 푸시
git push -u origin feat/single-server-migration
```

### 2.5 커밋 컨벤션

> 📌 프로젝트 커밋 컨벤션은 [docs/conventions/COMMIT_CONVENTION.md](./conventions/COMMIT_CONVENTION.md) 참조

**형식:** `{타입}: {설명}`

| 타입 | 설명 |
|------|------|
| feat | 새로운 기능 추가 |
| fix | 버그 수정 |
| setting | 빌드, 패키지 매니저 설정 등 환경 설정 관련 변경 |
| chore | 위 타입에 포함되지 않는 기타 작업 |
| docs | 문서 수정 |

**마이그레이션 커밋 예시:**

```bash
# Phase 1
"setting: Vite + React 프로젝트 초기 설정"
"feat: React Router 및 페이지 마이그레이션"
"feat: Phaser 게임 코드 이동"

# Phase 2
"setting: Express 프로젝트 초기 설정"
"feat: GitHub OAuth 인증 마이그레이션"
"feat: Socket.io 핸들러 마이그레이션"
"feat: GitHub 폴링 서비스 마이그레이션"

# Phase 3
"feat: 정적 파일 서빙 및 SPA 폴백 설정"
"setting: 빌드 스크립트 및 PM2 설정"
"chore: 기존 frontend/, backend/ 폴더 삭제"
```

### 2.6 작업 흐름

```
feat/single-server-migration (from deploy/test-all-prs 4ed5244)
    │
    ├── Phase 1: 프론트엔드 마이그레이션
    │     └── "setting: Vite + React 프로젝트 초기 설정"
    │     └── "feat: React Router 및 페이지 마이그레이션"
    │     └── "feat: Phaser 게임 코드 이동"
    │     │
    │     └── 🧪 테스트 포인트 A: client/ + 기존 backend/ 연동 테스트
    │
    ├── Phase 2: 백엔드 마이그레이션
    │     └── "setting: Express 프로젝트 초기 설정"
    │     └── "feat: GitHub OAuth 인증 마이그레이션"
    │     └── "feat: Socket.io 핸들러 마이그레이션"
    │     └── "feat: GitHub 폴링 서비스 마이그레이션"
    │
    └── Phase 3: 통합 및 정리
          └── "feat: 정적 파일 서빙 및 SPA 폴백 설정"
          └── "setting: 빌드 스크립트 및 PM2 설정"
          └── "chore: 기존 frontend/, backend/ 폴더 삭제"
```

### 2.7 머지 전략

```bash
# 마이그레이션 완료 후 main에 머지 (PR 생성)
gh pr create --base main --head feat/single-server-migration
```

---

## 3. 현재 아키텍처 분석

### 3.1 프론트엔드 구조

```
frontend/src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 메인 페이지 (게임 맵)
│   ├── layout.tsx                # 루트 레이아웃
│   ├── login/page.tsx            # 로그인 페이지
│   ├── auth/callback/page.tsx    # OAuth 콜백 처리
│   ├── api/github-profile/       # API Route (프록시) → 제거 예정
│   │   └── [username]/route.ts
│   └── _components/
│       ├── Map.tsx               # Phaser 게임 래퍼
│       └── ClientOnly.tsx        # SSR 비활성화 래퍼 → 제거 예정
├── components/
│   └── AuthGuard.tsx             # 인증 가드 HOC
├── stores/
│   └── authStore.ts              # Zustand 인증 상태
├── lib/
│   └── socket.ts                 # Socket.io 클라이언트
├── game/
│   ├── config.ts                 # Phaser 설정
│   ├── scenes/
│   │   └── MapScene.ts           # 메인 게임 씬
│   ├── players/
│   │   ├── Player.ts             # 로컬 플레이어
│   │   └── RemotePlayer.ts       # 원격 플레이어
│   └── ui/
│       ├── createProgressBar.ts  # 프로그레스바 UI
│       └── createContributionList.ts  # 기여도 리스트 UI
└── utils/
    └── timeFormat.ts             # 시간 포맷 유틸
```

### 3.2 프론트엔드 기능별 분석

| 기능 | 파일 | Next.js 의존성 | 마이그레이션 방향 |
|------|------|---------------|-----------------|
| 메인 페이지 | `app/page.tsx` | App Router | React Router로 변경 |
| 로그인 페이지 | `app/login/page.tsx` | `use client` only | 거의 그대로 |
| OAuth 콜백 | `app/auth/callback/page.tsx` | `useRouter` | `useNavigate`로 변경 |
| GitHub 프록시 | `app/api/github-profile/` | API Route | **제거** (직접 호출) |
| 레이아웃 | `app/layout.tsx` | Next.js Font | 일반 CSS로 변경 |
| SSR 비활성화 | `_components/ClientOnly.tsx` | `next/dynamic` | **제거** (SPA이므로 불필요) |
| 인증 가드 | `components/AuthGuard.tsx` | `useRouter` | `useNavigate`로 변경 |
| 상태 관리 | `stores/authStore.ts` | 없음 | 그대로 |
| 소켓 | `lib/socket.ts` | 없음 | 그대로 |
| 게임 로직 | `game/**` | 없음 | 그대로 |

### 3.3 백엔드 구조

```
backend/src/
├── main.ts                       # 앱 부트스트랩
├── app.module.ts                 # 루트 모듈
├── app.controller.ts             # 헬스체크 등
├── auth/
│   ├── auth.module.ts            # 인증 모듈
│   ├── auth.controller.ts        # OAuth 엔드포인트
│   ├── github.strategy.ts        # GitHub OAuth 전략
│   ├── github.guard.ts           # GitHub Guard
│   ├── jwt.strategy.ts           # JWT 전략
│   ├── jwt.guard.ts              # JWT Guard
│   ├── ws-jwt.guard.ts           # WebSocket JWT Guard
│   ├── user.store.ts             # 유저 메모리 저장소
│   └── user.interface.ts         # 유저 인터페이스
├── player/
│   ├── player.module.ts          # 플레이어 모듈
│   ├── player.gateway.ts         # WebSocket 게이트웨이
│   └── player.play-time-service.ts  # 플레이 타임 서비스
├── github/
│   ├── github.module.ts          # GitHub 모듈
│   ├── github.gateway.ts         # GitHub 이벤트 브로드캐스트
│   └── github.poll-service.ts    # GitHub API 폴링
└── config/
    ├── env.validation.ts         # 환경변수 검증
    └── logger.winston.ts         # 로거 설정
```

### 3.4 백엔드 기능별 분석

| 기능 | 파일 | NestJS 의존성 | 마이그레이션 방향 |
|------|------|--------------|-----------------|
| OAuth 엔드포인트 | `auth/auth.controller.ts` | Decorators, Guard | Express Router로 변경 |
| GitHub Strategy | `auth/github.strategy.ts` | PassportStrategy | passport.use()로 변경 |
| JWT Strategy | `auth/jwt.strategy.ts` | PassportStrategy | 미들웨어로 변경 |
| WS JWT Guard | `auth/ws-jwt.guard.ts` | 순수 로직 | 거의 그대로 |
| 유저 저장소 | `auth/user.store.ts` | @Injectable | 일반 클래스로 변경 |
| 플레이어 Gateway | `player/player.gateway.ts` | @WebSocketGateway | socket.io 핸들러로 변경 |
| 플레이 타임 | `player/player.play-time-service.ts` | @Injectable | 일반 클래스로 변경 |
| GitHub Gateway | `github/github.gateway.ts` | @WebSocketGateway | socket.io 핸들러로 변경 |
| GitHub Polling | `github/github.poll-service.ts` | @Injectable | 일반 클래스로 변경 |
| 환경변수 검증 | `config/env.validation.ts` | Joi | 그대로 (Joi 직접 사용) |
| Prometheus | `app.module.ts` | nestjs-prometheus | **제거** |

### 3.5 환경 변수

```bash
# 필수
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
JWT_SECRET=xxx (32자 이상)

# 선택 (기본값 있음)
PORT=8080
FRONTEND_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback
```

---

## 4. 목표 아키텍처

### 4.1 폴더 구조

```
project/
├── client/                    # React + Vite
│   ├── src/
│   │   ├── main.tsx          # 진입점
│   │   ├── App.tsx           # 라우터 설정
│   │   ├── pages/
│   │   │   ├── Home.tsx      # 메인 (게임)
│   │   │   ├── Login.tsx     # 로그인
│   │   │   └── AuthCallback.tsx  # OAuth 콜백
│   │   ├── components/
│   │   │   └── AuthGuard.tsx
│   │   ├── stores/
│   │   │   └── authStore.ts
│   │   ├── lib/
│   │   │   └── socket.ts
│   │   ├── game/             # 그대로 이동
│   │   └── utils/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                    # Express
│   ├── src/
│   │   ├── index.ts          # 진입점
│   │   ├── routes/
│   │   │   └── auth.ts       # OAuth 라우트
│   │   ├── middleware/
│   │   │   └── jwt.ts        # JWT 미들웨어
│   │   ├── socket/
│   │   │   ├── index.ts      # Socket.io 설정
│   │   │   ├── playerHandler.ts
│   │   │   └── githubHandler.ts
│   │   ├── services/
│   │   │   ├── userStore.ts
│   │   │   ├── playTimeService.ts
│   │   │   └── githubPollService.ts
│   │   └── config/
│   │       └── env.ts
│   └── package.json
│
├── package.json               # 워크스페이스 루트
└── ecosystem.config.js        # PM2 설정
```

### 4.2 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (단일 프로세스)             │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Static Files    │  │ API Routes      │                   │
│  │ (React Build)   │  │ /auth/*         │                   │
│  │ /index.html     │  │                 │                   │
│  │ /assets/*       │  │                 │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Socket.io Server                      ││
│  │  - Player events (joining, moving, disconnect)          ││
│  │  - GitHub events (github_event, github_state)           ││
│  │  - Timer events (timerUpdated)                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 리소스 분석

### 5.1 메모리 사용량 비교

| 항목 | 현재 (2 프로세스) | 목표 (1 프로세스) |
|------|------------------|------------------|
| Next.js 서버 | ~150-200 MB | 0 MB |
| NestJS 서버 | ~100-150 MB | - |
| Express 서버 | - | ~80-120 MB |
| **기본 총합** | **~250-350 MB** | **~80-120 MB** |

### 5.2 50명 접속 시 예상

| 항목 | 사용량 |
|------|--------|
| 서버 기본 | ~100 MB |
| 50명 × 0.1 MB | ~5 MB |
| OS 예약 | ~150 MB |
| **총합** | **~255 MB** |
| **1GB 중 사용률** | **~25%** |

### 5.3 CPU 분석

현재 **State Change Detection** 최적화가 적용되어 50명 동시 접속 가능:

```typescript
// 상태 변화 시에만 메시지 전송
if (isMoving !== this.prevState.isMoving ||
    currentDirection !== this.prevState.direction) {
  emitEvent("moving", payload);
}
```

---

## 6. 마이그레이션 단계별 계획

### 전체 흐름도

```
[시작] main 브랜치에서 feat/single-server-migration 분기
    │
    ▼
[Phase 1] 프론트엔드 마이그레이션
    │
    ├── 1.1 Vite 프로젝트 설정
    ├── 1.2 라우터 및 페이지 마이그레이션
    ├── 1.3 게임 코드 이동
    │
    ▼
┌─────────────────────────────────────────┐
│  🧪 테스트 포인트 A                      │
│  프론트엔드 단독 실행 + 기존 백엔드 연동   │
└─────────────────────────────────────────┘
    │
    ▼
[Phase 2] 백엔드 마이그레이션
    │
    ├── 2.1 Express 프로젝트 설정
    ├── 2.2 인증 시스템 마이그레이션
    │       │
    │       ▼
    │   ┌─────────────────────────────────────────┐
    │   │  🧪 테스트 포인트 B                      │
    │   │  OAuth 로그인 + JWT 발급 테스트          │
    │   └─────────────────────────────────────────┘
    │
    ├── 2.3 Socket.io 핸들러 마이그레이션
    │       │
    │       ▼
    │   ┌─────────────────────────────────────────┐
    │   │  🧪 테스트 포인트 C                      │
    │   │  실시간 플레이어 이동 동기화 테스트       │
    │   └─────────────────────────────────────────┘
    │
    ├── 2.4 GitHub 폴링 서비스 마이그레이션
    │       │
    │       ▼
    │   ┌─────────────────────────────────────────┐
    │   │  🧪 테스트 포인트 D                      │
    │   │  GitHub 커밋 감지 + 프로그레스바 테스트   │
    │   └─────────────────────────────────────────┘
    │
    ▼
[Phase 3] 통합 및 배포
    │
    ├── 3.1 정적 파일 서빙 설정
    ├── 3.2 빌드 스크립트 작성
    ├── 3.3 PM2 배포 설정
    │
    ▼
┌─────────────────────────────────────────┐
│  🧪 테스트 포인트 E                      │
│  전체 통합 테스트 + 부하 테스트           │
└─────────────────────────────────────────┘
    │
    ▼
[완료] main 브랜치에 머지
```

---

### 사전 작업: 브랜치 생성

```bash
# 1. main 브랜치 최신화
git checkout main
git pull origin main

# 2. 분기 지점 확인 (94e55a8이 최신 안정 커밋)
git log --oneline -5
# 94e55a8 feat: GitHub 폴링 OAuth 인증 및 프로그레스바 연동 (#35)

# 3. 마이그레이션 브랜치 생성
git checkout -b feat/single-server-migration

# 4. 원격에 브랜치 푸시
git push -u origin feat/single-server-migration
```

---

### Phase 1: 프론트엔드 마이그레이션

#### 1.1 Vite 프로젝트 설정

**작업 내용:**
1. `client/` 디렉토리에 Vite + React + TypeScript 프로젝트 생성
2. 필요한 의존성 설치 (phaser, socket.io-client, zustand, react-router-dom)
3. Tailwind CSS 설정
4. Vite alias 설정 (`@/` → `src/`)

**명령어:**
```bash
pnpm create vite client --template react-ts
cd client
pnpm add phaser socket.io-client zustand react-router-dom
pnpm add -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

**커밋:**
```bash
git add client/
git commit -m "feat(client): Vite + React 프로젝트 초기 설정"
```

---

#### 1.2 라우터 및 페이지 마이그레이션

**작업 순서:**

| 순서 | 파일 | 작업 |
|-----|------|------|
| 1 | `src/App.tsx` | React Router 설정 |
| 2 | `src/pages/Login.tsx` | 환경변수만 변경 (`NEXT_PUBLIC_*` → `VITE_*`) |
| 3 | `src/pages/AuthCallback.tsx` | `useRouter` → `useNavigate` |
| 4 | `src/components/AuthGuard.tsx` | `useRouter` → `useNavigate` |
| 5 | `src/pages/Home.tsx` | `ClientOnly` 래퍼 제거, Map 직접 렌더 |
| 6 | `src/stores/authStore.ts` | 환경변수만 변경 |
| 7 | `src/lib/socket.ts` | 환경변수만 변경 |

**커밋:**
```bash
git add client/src/
git commit -m "feat(client): React Router 및 페이지 마이그레이션"
```

---

#### 1.3 게임 코드 이동

**작업 순서:**

| 순서 | 파일 | 작업 |
|-----|------|------|
| 1 | `src/game/config.ts` | 그대로 복사 |
| 2 | `src/game/scenes/MapScene.ts` | GitHub 프로필 URL 직접 호출로 변경 |
| 3 | `src/game/players/Player.ts` | import 경로만 수정 |
| 4 | `src/game/players/RemotePlayer.ts` | import 경로만 수정 |
| 5 | `src/game/ui/*.ts` | import 경로만 수정 |
| 6 | `src/utils/timeFormat.ts` | 그대로 복사 |
| 7 | `src/components/Map.tsx` | Phaser 초기화 (기존과 동일) |

**GitHub 프로필 이미지 변경:**
```typescript
// 변경 전 (프록시 사용)
this.load.image("face", `/api/github-profile/${username}`);

// 변경 후 (직접 호출 - CORS 허용됨)
this.load.image("face", `https://github.com/${username}.png`);
```

**커밋:**
```bash
git add client/src/game/ client/src/utils/
git commit -m "feat(client): Phaser 게임 코드 이동"
```

---

### 🧪 테스트 포인트 A: 프론트엔드 + 기존 백엔드

**목적:** 새 프론트엔드가 기존 NestJS 백엔드와 정상 연동되는지 확인

**환경:**
- 새 프론트엔드: `http://localhost:5173` (Vite dev server)
- 기존 백엔드: `http://localhost:8080` (NestJS)

**실행 방법:**
```bash
# 터미널 1: 기존 백엔드 실행
cd backend && pnpm start:dev

# 터미널 2: 새 프론트엔드 실행
cd client && pnpm dev
```

**테스트 체크리스트:**

| # | 테스트 항목 | 확인 방법 | 예상 결과 |
|---|------------|----------|----------|
| 1 | 로그인 리다이렉트 | `http://localhost:5173` 접속 | `/login`으로 리다이렉트 |
| 2 | GitHub OAuth | 로그인 버튼 클릭 | GitHub 로그인 페이지 표시 |
| 3 | OAuth 콜백 | 로그인 완료 후 | 메인 페이지(게임) 표시 |
| 4 | 캐릭터 이동 | 방향키 입력 | 캐릭터 이동 |
| 5 | 멀티플레이어 | 다른 브라우저 접속 | 상대방 캐릭터 표시 |
| 6 | 프로필 이미지 | 게임 화면 확인 | GitHub 프로필 이미지 로드 |
| 7 | WebSocket 연결 | DevTools > Network > WS | `connected` 상태 |

**성공 기준:** 모든 체크리스트 통과

**실패 시:**
- Vite 프록시 설정 확인 (`vite.config.ts`)
- CORS 설정 확인
- 환경변수 확인 (`VITE_API_URL`, `VITE_SOCKET_URL`)

---

### Phase 2: 백엔드 마이그레이션

#### 2.1 Express 프로젝트 설정

**작업 내용:**
1. `server/` 디렉토리에 Express + TypeScript 프로젝트 생성
2. 필요한 의존성 설치
3. 환경변수 검증 로직 마이그레이션

**명령어:**
```bash
mkdir server && cd server
pnpm init
pnpm add express socket.io passport passport-github2 passport-jwt \
  jsonwebtoken cookie-parser cors dotenv joi winston
pnpm add -D typescript @types/node @types/express ts-node nodemon \
  @types/passport-github2 @types/passport-jwt @types/jsonwebtoken \
  @types/cookie-parser @types/cors
npx tsc --init
```

**파일 생성:**

| 순서 | 파일 | 작업 |
|-----|------|------|
| 1 | `src/config/env.ts` | Joi 검증 로직 (기존과 동일) |
| 2 | `src/config/logger.ts` | Winston 설정 (단순화) |
| 3 | `src/index.ts` | Express 앱 진입점 (기본 구조만) |

**커밋:**
```bash
git add server/
git commit -m "feat(server): Express 프로젝트 초기 설정"
```

---

#### 2.2 인증 시스템 마이그레이션

**작업 순서:**

| 순서 | 파일 | 기존 | 신규 |
|-----|------|------|------|
| 1 | UserStore | `@Injectable()` 클래스 | 일반 싱글톤 클래스 |
| 2 | GitHub OAuth | `PassportStrategy` | `passport.use()` |
| 3 | JWT 검증 | `JwtStrategy` + `JwtGuard` | Express 미들웨어 |
| 4 | Auth Routes | `@Controller` + Decorators | Express Router |

**커밋:**
```bash
git add server/src/routes/ server/src/services/userStore.ts
git commit -m "feat(server): GitHub OAuth 인증 마이그레이션"
```

---

### 🧪 테스트 포인트 B: OAuth 로그인 테스트

**목적:** 새 Express 서버의 OAuth 인증이 정상 동작하는지 확인

**환경:**
- 새 프론트엔드: `http://localhost:5173`
- 새 백엔드: `http://localhost:8080` (Express - 인증만 구현)

**실행 방법:**
```bash
# 터미널 1: 새 백엔드 실행
cd server && pnpm dev

# 터미널 2: 새 프론트엔드 실행
cd client && pnpm dev
```

**테스트 체크리스트:**

| # | 테스트 항목 | 확인 방법 | 예상 결과 |
|---|------------|----------|----------|
| 1 | GitHub 리다이렉트 | `GET /auth/github` 호출 | GitHub 로그인 페이지 |
| 2 | OAuth 콜백 | 로그인 완료 후 | 프론트엔드로 리다이렉트 |
| 3 | JWT 쿠키 | DevTools > Application > Cookies | `access_token` 쿠키 존재 |
| 4 | 유저 정보 | `GET /auth/me` 호출 | `{ githubId, username, avatarUrl }` |
| 5 | 로그아웃 | `GET /auth/logout` 호출 | 쿠키 삭제 + 리다이렉트 |

**테스트 명령어:**
```bash
# 쿠키로 API 호출 테스트
curl -v http://localhost:8080/auth/me --cookie "access_token=YOUR_TOKEN"

# 예상 응답
# {"githubId":"12345","username":"your-username","avatarUrl":"..."}
```

**성공 기준:** OAuth 로그인 → JWT 발급 → `/auth/me` 호출 성공

**실패 시:**
- GitHub OAuth App 설정 확인 (Client ID, Secret, Callback URL)
- JWT_SECRET 환경변수 확인
- 쿠키 설정 확인 (httpOnly, sameSite, secure)

---

#### 2.3 Socket.io 핸들러 마이그레이션

**작업 순서:**

| 순서 | 파일 | 기존 | 신규 |
|-----|------|------|------|
| 1 | Socket 설정 | `@WebSocketGateway` | `new Server()` |
| 2 | JWT 검증 | `WsJwtGuard.verifyClient()` | `io.use()` 미들웨어 |
| 3 | Player 핸들러 | `@SubscribeMessage()` | `socket.on()` |
| 4 | PlayTime 서비스 | `@Injectable()` | 일반 싱글톤 |

**마이그레이션할 이벤트:**

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `joining` | Client → Server | 방 입장 |
| `moving` | Client → Server | 이동 정보 |
| `disconnect` | Client → Server | 연결 해제 |
| `players_synced` | Server → Client | 기존 플레이어 목록 |
| `player_joined` | Server → Client | 새 플레이어 입장 |
| `player_left` | Server → Client | 플레이어 퇴장 |
| `moved` | Server → Client | 이동 브로드캐스트 |
| `timerUpdated` | Server → Client | 접속 시간 업데이트 |
| `session_replaced` | Server → Client | 중복 접속 알림 |

**커밋:**
```bash
git add server/src/socket/ server/src/services/playTimeService.ts
git commit -m "feat(server): Socket.io 핸들러 마이그레이션"
```

---

### 🧪 테스트 포인트 C: 실시간 이동 동기화

**목적:** Socket.io 기반 실시간 통신이 정상 동작하는지 확인

**환경:**
- 새 프론트엔드: `http://localhost:5173`
- 새 백엔드: `http://localhost:8080` (Express - 인증 + Socket.io)

**실행 방법:**
```bash
# 동일하게 실행
cd server && pnpm dev
cd client && pnpm dev
```

**테스트 체크리스트:**

| # | 테스트 항목 | 확인 방법 | 예상 결과 |
|---|------------|----------|----------|
| 1 | WebSocket 연결 | DevTools > Network > WS | 연결 성공 |
| 2 | 방 입장 | 로그인 후 게임 접속 | `joining` 이벤트 전송 |
| 3 | 캐릭터 이동 | 방향키 입력 | `moving` 이벤트 전송 |
| 4 | 플레이어 동기화 | 다른 브라우저 접속 | `player_joined` 수신 |
| 5 | 이동 동기화 | 상대방 이동 | `moved` 이벤트로 위치 업데이트 |
| 6 | 퇴장 처리 | 브라우저 닫기 | `player_left` 수신, 캐릭터 제거 |
| 7 | 타이머 | 60초 대기 | `timerUpdated` 수신 (1분) |
| 8 | 중복 접속 | 같은 계정 다른 탭 | 이전 탭에 `session_replaced` |

**성공 기준:** 2개 이상의 브라우저에서 실시간 이동 동기화 정상 동작

**실패 시:**
- Socket.io 연결 상태 확인
- JWT 쿠키 전달 확인
- CORS 설정 확인

---

#### 2.4 GitHub 폴링 서비스 마이그레이션

**작업 순서:**

| 순서 | 파일 | 기존 | 신규 |
|-----|------|------|------|
| 1 | Poll 서비스 | `@Injectable()` + DI | 일반 싱글톤 + 콜백 |
| 2 | GitHub Gateway | `@WebSocketGateway` | Socket 핸들러에 통합 |
| 3 | 룸 상태 관리 | 별도 클래스 | 핸들러 내 Map |

**마이그레이션할 이벤트:**

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `github_event` | Server → Client | 새 커밋/PR 감지 |
| `github_state` | Server → Client | 룸 상태 복원 |

**커밋:**
```bash
git add server/src/services/githubPollService.ts server/src/socket/
git commit -m "feat(server): GitHub 폴링 서비스 마이그레이션"
```

---

### 🧪 테스트 포인트 D: GitHub 커밋 감지

**목적:** GitHub 활동이 실시간으로 게임에 반영되는지 확인

**환경:**
- 새 프론트엔드 + 새 백엔드 (전체 기능 구현)

**테스트 방법:**
1. 로그인 후 게임 접속
2. 별도의 레포지토리에 커밋 푸시
3. 30초 이내 프로그레스바 증가 확인

**테스트 체크리스트:**

| # | 테스트 항목 | 확인 방법 | 예상 결과 |
|---|------------|----------|----------|
| 1 | 초기 상태 | 접속 시 | `github_state` 이벤트 수신 |
| 2 | 커밋 감지 | 레포에 커밋 푸시 후 30초 | `github_event` 수신 |
| 3 | 프로그레스바 | 커밋 후 화면 확인 | 프로그레스바 2% 증가 |
| 4 | 기여도 리스트 | 화면 상단 확인 | `username:count` 표시 |
| 5 | PR 감지 | PR 생성 후 30초 | 프로그레스바 5% 증가 |
| 6 | 상태 복원 | 새로고침 | 기존 진행도 유지 |

**성공 기준:** GitHub 활동이 30초 이내에 게임에 반영됨

**실패 시:**
- GitHub API 응답 확인 (rate limit 등)
- accessToken 유효성 확인
- 폴링 로그 확인

---

### Phase 3: 통합 및 배포

#### 3.1 정적 파일 서빙 설정

**작업 내용:**
```typescript
// server/src/index.ts에 추가
import path from 'path';

// React 빌드 파일 서빙
const clientPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientPath));

// SPA 폴백
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  res.sendFile(path.join(clientPath, 'index.html'));
});
```

**커밋:**
```bash
git add server/src/index.ts
git commit -m "feat: 정적 파일 서빙 및 SPA 폴백 설정"
```

---

#### 3.2 빌드 스크립트 작성

**루트 `package.json`:**
```json
{
  "scripts": {
    "build": "pnpm build:client && pnpm build:server",
    "build:client": "cd client && pnpm build",
    "build:server": "cd server && pnpm build",
    "start": "node server/dist/index.js",
    "dev": "concurrently \"cd client && pnpm dev\" \"cd server && pnpm dev\""
  }
}
```

**커밋:**
```bash
git add package.json
git commit -m "chore: 빌드 스크립트 추가"
```

---

#### 3.3 PM2 배포 설정

**`ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'mogakco',
    script: './server/dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '800M',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
    },
  }],
};
```

**커밋:**
```bash
git add ecosystem.config.js
git commit -m "chore: PM2 배포 설정"
```

---

### 🧪 테스트 포인트 E: 전체 통합 테스트

**목적:** 프로덕션 빌드에서 모든 기능이 정상 동작하는지 확인

**환경:**
- 프로덕션 빌드 (`pnpm build`)
- 단일 Express 서버 (`pnpm start`)
- URL: `http://localhost:8080`

**실행 방법:**
```bash
# 빌드
pnpm build

# 프로덕션 모드 실행
NODE_ENV=production pnpm start

# 접속
open http://localhost:8080
```

**테스트 체크리스트:**

| 카테고리 | # | 테스트 항목 | 확인 방법 | 예상 결과 |
|----------|---|------------|----------|----------|
| 정적 파일 | 1 | 메인 페이지 로드 | `http://localhost:8080` | React 앱 표시 |
| 정적 파일 | 2 | 에셋 로드 | 게임 화면 확인 | 맵, 캐릭터 이미지 표시 |
| 라우팅 | 3 | 로그인 페이지 | `/login` 접속 | 로그인 버튼 표시 |
| 라우팅 | 4 | 404 처리 | `/invalid-path` 접속 | 메인으로 리다이렉트 |
| 인증 | 5 | GitHub OAuth | 로그인 버튼 클릭 | OAuth 플로우 정상 |
| 인증 | 6 | JWT 쿠키 | DevTools 확인 | 쿠키 설정됨 |
| WebSocket | 7 | 연결 | 게임 접속 | WS 연결 성공 |
| WebSocket | 8 | 이동 동기화 | 멀티 브라우저 테스트 | 실시간 동기화 |
| GitHub | 9 | 커밋 감지 | 커밋 푸시 후 30초 | 프로그레스바 증가 |
| 타이머 | 10 | 접속 시간 | 60초 대기 | 타이머 1분 표시 |
| 중복 접속 | 11 | 세션 관리 | 다른 탭 접속 | 이전 세션 종료 |

**부하 테스트:**
```bash
# Artillery 설치
npm install -g artillery

# 부하 테스트 설정 파일 생성
cat > load-test.yml << EOF
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/"
EOF

# 부하 테스트 실행
artillery run load-test.yml
```

**성공 기준:**
- 모든 체크리스트 통과
- 부하 테스트에서 에러율 < 1%

**완료 후:**
```bash
# main 브랜치에 머지
git checkout main
git merge feat/single-server-migration
git push origin main

# 또는 PR 생성
gh pr create --base main --head feat/single-server-migration \
  --title "feat: 단일 서버 마이그레이션 (Next.js + NestJS → React + Express)" \
  --body "## Summary
- Next.js → React + Vite
- NestJS → Express
- 2 프로세스 → 1 프로세스
- VM.Standard.E2.1.Micro 환경 최적화

## Test Plan
- [x] 테스트 포인트 A~E 모두 통과"
```

---

## 7. 프론트엔드 상세 마이그레이션

### 7.1 App.tsx (라우터 설정)

```tsx
// 변경 전: Next.js App Router (파일 기반)
// 변경 후: React Router

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import AuthGuard from './components/AuthGuard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={
          <AuthGuard>
            <Home />
          </AuthGuard>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 7.2 환경 변수 변경

```bash
# 변경 전 (.env)
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080

# 변경 후 (.env)
VITE_API_URL=http://localhost:8080
VITE_SOCKET_URL=http://localhost:8080
```

```typescript
// 코드 내 사용
// 변경 전
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// 변경 후
const API_URL = import.meta.env.VITE_API_URL;
```

### 7.3 라우터 훅 변경

```typescript
// 변경 전
import { useRouter } from "next/navigation";
const router = useRouter();
router.replace("/login");

// 변경 후
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();
navigate("/login", { replace: true });
```

### 7.4 GitHub 프로필 이미지 (프록시 제거)

```typescript
// MapScene.ts
// 변경 전 (Next.js API Route 프록시)
this.load.image("face", `/api/github-profile/${username}`);

// 변경 후 (직접 호출 - CORS 허용됨)
this.load.image("face", `https://github.com/${username}.png`);
```

### 7.5 Vite 설정

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

---

## 8. 백엔드 상세 마이그레이션

### 8.1 환경변수 검증 (`config/env.ts`)

```typescript
import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const schema = Joi.object({
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  PORT: Joi.number().default(8080),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  GITHUB_CALLBACK_URL: Joi.string().default('http://localhost:8080/auth/github/callback'),
});

const { error, value } = schema.validate(process.env, {
  allowUnknown: true,
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = value;
```

### 8.2 서버 진입점 (`index.ts`)

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import passport from 'passport';
import { config } from './config/env';
import { setupAuthRoutes } from './routes/auth';
import { setupSocketHandlers } from './socket';
import { logger } from './config/logger';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.FRONTEND_URL,
    credentials: true,
  },
});

// 미들웨어
app.use(cookieParser());
app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

// 라우트
setupAuthRoutes(app);

// 정적 파일 (프로덕션)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Socket.io
setupSocketHandlers(io);

httpServer.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});
```

### 8.3 인증 라우트 (`routes/auth.ts`)

```typescript
import { Router, Express, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { userStore } from '../services/userStore';

export function setupAuthRoutes(app: Express) {
  // GitHub 전략 설정
  passport.use(new GitHubStrategy({
    clientID: config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_CLIENT_SECRET,
    callbackURL: config.GITHUB_CALLBACK_URL,
    scope: ['repo'],
  }, (accessToken, refreshToken, profile, done) => {
    const user = userStore.findOrCreate({
      githubId: profile.id,
      username: profile.username || `github-${profile.id}`,
      avatarUrl: profile.photos?.[0]?.value || '',
      accessToken,
    });
    done(null, user);
  }));

  const router = Router();

  router.get('/github', passport.authenticate('github', { session: false }));

  router.get('/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      const user = req.user as any;
      const token = jwt.sign(
        { sub: user.githubId, username: user.username },
        config.JWT_SECRET,
        { expiresIn: '1d' }
      );
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.redirect(`${config.FRONTEND_URL}/auth/callback`);
    }
  );

  router.get('/me', authenticateJWT, (req, res) => {
    const user = req.user as any;
    res.json({ githubId: user.githubId, username: user.username, avatarUrl: user.avatarUrl });
  });

  router.get('/logout', (req, res) => {
    res.clearCookie('access_token');
    res.redirect(config.FRONTEND_URL);
  });

  app.use('/auth', router);
}

function authenticateJWT(req: Request, res: Response, next: Function) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;
    const user = userStore.findByGithubId(payload.sub);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}
```

### 8.4 Socket 핸들러 (`socket/index.ts`)

```typescript
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { userStore } from '../services/userStore';
import { playTimeService } from '../services/playTimeService';
import { githubPollService } from '../services/githubPollService';

const players = new Map();
const userSockets = new Map();
const roomStates = new Map();

export function setupSocketHandlers(io: Server) {
  // JWT 검증 미들웨어
  io.use((socket, next) => {
    const cookies = socket.handshake.headers?.cookie;
    const tokenMatch = cookies?.match(/access_token=([^;]+)/);
    if (!tokenMatch) return next(new Error('Unauthorized'));

    try {
      const payload = jwt.verify(tokenMatch[1], config.JWT_SECRET) as any;
      const user = userStore.findByGithubId(payload.sub);
      if (!user) return next(new Error('User not found'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    socket.on('joining', (data) => {
      const roomId = data.roomId || 'default-room';

      // 중복 접속 처리
      const existingSocketId = userSockets.get(user.username);
      if (existingSocketId && existingSocketId !== socket.id) {
        io.sockets.sockets.get(existingSocketId)?.emit('session_replaced');
        io.sockets.sockets.get(existingSocketId)?.disconnect(true);
      }

      userSockets.set(user.username, socket.id);
      socket.join(roomId);

      players.set(socket.id, {
        socketId: socket.id,
        username: user.username,
        roomId,
        x: data.x,
        y: data.y,
      });

      // 기존 플레이어 전송
      const existing = [...players.values()].filter(p =>
        p.socketId !== socket.id && p.roomId === roomId
      );
      socket.emit('players_synced', existing);
      socket.to(roomId).emit('player_joined', {
        userId: socket.id,
        username: user.username,
        x: data.x,
        y: data.y,
      });

      // 타이머 시작
      playTimeService.startTimer(socket.id, user.username, (minutes) => {
        io.to(roomId).emit('timerUpdated', { userId: socket.id, minutes });
      });

      // GitHub 폴링 시작
      githubPollService.subscribe(socket.id, roomId, user.username, user.accessToken,
        (event) => {
          updateRoomState(roomId, event);
          io.to(roomId).emit('github_event', event);
        }
      );

      socket.emit('github_state', getRoomState(roomId));
    });

    socket.on('moving', (data) => {
      const player = players.get(socket.id);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
      socket.to(data.roomId).emit('moved', {
        userId: socket.id,
        ...data,
      });
    });

    socket.on('disconnect', () => {
      const player = players.get(socket.id);
      if (player) {
        io.to(player.roomId).emit('player_left', { userId: socket.id });
        players.delete(socket.id);
        playTimeService.stopTimer(socket.id);
        githubPollService.unsubscribe(socket.id);
        if (userSockets.get(player.username) === socket.id) {
          userSockets.delete(player.username);
        }
      }
    });
  });
}
```

### 8.5 서비스 클래스들

**UserStore, PlayTimeService, GithubPollService**는 기존 NestJS 버전에서 `@Injectable()` 데코레이터만 제거하고 일반 싱글톤으로 변경합니다. 로직은 동일합니다.

---

## 9. 통합 및 배포

### 9.1 최종 체크리스트

| Phase | 항목 | 커밋 메시지 | 완료 |
|-------|------|------------|------|
| **사전** | main에서 브랜치 분기 | - | [ ] |
| **1.1** | Vite 프로젝트 생성 | `feat(client): Vite + React 프로젝트 초기 설정` | [ ] |
| **1.2** | 페이지 마이그레이션 | `feat(client): React Router 및 페이지 마이그레이션` | [ ] |
| **1.3** | 게임 코드 이동 | `feat(client): Phaser 게임 코드 이동` | [ ] |
| **A** | 🧪 프론트엔드 + 기존 백엔드 테스트 | - | [ ] |
| **2.1** | Express 프로젝트 생성 | `feat(server): Express 프로젝트 초기 설정` | [ ] |
| **2.2** | 인증 시스템 마이그레이션 | `feat(server): GitHub OAuth 인증 마이그레이션` | [ ] |
| **B** | 🧪 OAuth 로그인 테스트 | - | [ ] |
| **2.3** | Socket.io 핸들러 마이그레이션 | `feat(server): Socket.io 핸들러 마이그레이션` | [ ] |
| **C** | 🧪 실시간 이동 동기화 테스트 | - | [ ] |
| **2.4** | GitHub 폴링 마이그레이션 | `feat(server): GitHub 폴링 서비스 마이그레이션` | [ ] |
| **D** | 🧪 GitHub 커밋 감지 테스트 | - | [ ] |
| **3.1** | 정적 파일 서빙 설정 | `feat: 정적 파일 서빙 및 SPA 폴백 설정` | [ ] |
| **3.2** | 빌드 스크립트 작성 | `chore: 빌드 스크립트 추가` | [ ] |
| **3.3** | PM2 배포 설정 | `chore: PM2 배포 설정` | [ ] |
| **E** | 🧪 전체 통합 + 부하 테스트 | - | [ ] |
| **완료** | main 브랜치에 머지 | - | [ ] |

### 9.2 예상 리소스 사용량

| 환경 | 메모리 | 50명 접속 시 |
|------|--------|-------------|
| 현재 (2 프로세스) | ~300 MB | ~310 MB |
| 목표 (1 프로세스) | ~100 MB | ~110 MB |
| **절약** | **200 MB** | **200 MB** |

### 9.3 롤백 계획

마이그레이션 실패 시:
1. 기존 `frontend/`, `backend/` 코드는 그대로 유지
2. `feat/single-server-migration` 브랜치 삭제
3. PM2에서 기존 설정으로 재시작
4. 문제 분석 후 새 브랜치에서 재시도
