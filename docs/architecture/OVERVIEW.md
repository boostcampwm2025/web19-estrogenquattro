# 프로젝트 전체 구조

## 서비스 개요

GitHub 활동(커밋, PR)을 실시간으로 감지하여 게임 내 프로그레스바에 반영하는 멀티플레이어 게이미피케이션 서비스

```
사용자 GitHub 활동 → 서버 폴링 감지 → WebSocket 전송 → 게임 UI 반영
```

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  Next.js (SSG)          │  Phaser 3 Game Engine                 │
│  ├─ 로그인 페이지        │  ├─ MapScene (메인 게임 화면)          │
│  ├─ 게임 페이지          │  ├─ Player (로컬 플레이어)            │
│  └─ UI 컴포넌트          │  ├─ RemotePlayer (다른 플레이어)      │
│     (TasksMenu, Modal)   │  └─ UI (프로그레스바, 기여도 목록)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Socket.io │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                            │
├─────────────────────────────────────────────────────────────────┤
│  Modules                                                         │
│  ├─ AuthModule      : GitHub OAuth, JWT 인증                     │
│  ├─ PlayerModule    : 플레이어 이동, 접속 시간                    │
│  ├─ ChatModule      : 채팅 브로드캐스팅                          │
│  ├─ GithubModule    : GitHub GraphQL 폴링                        │
│  ├─ RoomModule      : 랜덤 방 배정                               │
│  └─ TaskModule      : Task 엔티티                                │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure                                                  │
│  ├─ SQLite + TypeORM (데이터 저장)                               │
│  ├─ Winston (로깅)                                               │
│  └─ Prometheus (메트릭)                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    GraphQL API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub API                                  │
│  └─ contributionsCollection (커밋, PR 기여 조회)                  │
└─────────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
.
├── backend/                 # NestJS 백엔드
│   ├── src/
│   │   ├── auth/           # GitHub OAuth, JWT
│   │   ├── chat/           # 채팅 기능
│   │   ├── config/         # 환경설정, 로깅
│   │   ├── database/       # TypeORM 설정, 마이그레이션
│   │   ├── focustime/      # 포커스타임 기능
│   │   ├── github/         # GitHub 폴링
│   │   ├── player/         # 플레이어 관리
│   │   ├── room/           # 방 관리
│   │   └── task/           # Task 엔티티
│   └── public/             # 프론트엔드 빌드 결과물 (정적 서빙)
│
├── frontend/               # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/           # 페이지, 컴포넌트
│   │   ├── game/          # Phaser 게임 엔진
│   │   │   ├── players/   # Player, RemotePlayer
│   │   │   ├── scenes/    # MapScene
│   │   │   ├── managers/  # 게임 매니저 (Socket, Map, Chat)
│   │   │   └── ui/        # 게임 내 UI
│   │   ├── stores/        # Zustand 상태 관리
│   │   └── lib/           # 유틸리티
│   └── public/            # 정적 에셋 (맵, 스프라이트)
│
└── docs/                  # 문서
```

---

## Backend 파일 상세

### 루트 파일

| 파일 | 설명 |
|------|------|
| `main.ts` | 애플리케이션 진입점, NestJS 부트스트랩 |
| `app.module.ts` | 루트 모듈, 모든 모듈 import |
| `app.controller.ts` | 헬스체크 등 기본 엔드포인트 |

### auth/ (인증)

| 파일 | 설명 |
|------|------|
| `auth.module.ts` | 인증 모듈 정의 |
| `auth.controller.ts` | `/auth/github`, `/auth/me`, `/auth/logout` 엔드포인트 |
| `github.strategy.ts` | Passport GitHub OAuth2 전략 |
| `github.guard.ts` | GitHub OAuth 가드 |
| `jwt.strategy.ts` | Passport JWT 전략 (쿠키에서 토큰 추출) |
| `jwt.guard.ts` | REST API용 JWT 인증 가드 |
| `ws-jwt.guard.ts` | WebSocket 연결용 JWT 인증 가드 |
| `user.store.ts` | 인메모리 사용자 저장소 (세션 유지) |
| `user.interface.ts` | User 타입 정의 |
| `player-id.decorator.ts` | `@PlayerId()` 파라미터 데코레이터 |

### chat/ (채팅)

| 파일 | 설명 |
|------|------|
| `chat.module.ts` | 채팅 모듈 정의 |
| `chat.gateway.ts` | `chatting` 이벤트 처리, 방 내 브로드캐스트 |

### config/ (설정)

| 파일 | 설명 |
|------|------|
| `env.validation.ts` | 환경변수 스키마 검증 (Joi) |
| `frontend-urls.ts` | CORS 허용 프론트엔드 URL 목록 |
| `logger.winston.ts` | Winston 로거 설정 |
| `socket-io.adapter.ts` | Socket.io 어댑터 (CORS 설정 포함) |

### database/ (데이터베이스)

| 파일 | 설명 |
|------|------|
| `data-source.ts` | TypeORM 데이터소스 설정 |
| `migrations/*.ts` | 스키마 마이그레이션 파일 |

### focustime/ (포커스타임)

| 파일 | 설명 |
|------|------|
| `focustime.module.ts` | 포커스타임 모듈 정의 |
| `focustime.service.ts` | 집중/휴식 상태 전환, 시간 누적 로직 |
| `focustime.gateway.ts` | `focusing`, `resting` 이벤트 처리 |
| `entites/daily-focus-time.entity.ts` | DailyFocusTime 엔티티 (일별 집중 기록) |

### github/ (GitHub 폴링)

| 파일 | 설명 |
|------|------|
| `github.module.ts` | GitHub 모듈 정의 |
| `github.poll-service.ts` | GraphQL API 30초 폴링, 기준점 관리 |
| `github.gateway.ts` | `github_event` 브로드캐스트, 프로그레스 계산 |

### player/ (플레이어)

| 파일 | 설명 |
|------|------|
| `player.module.ts` | 플레이어 모듈 정의 |
| `player.service.ts` | 플레이어 생성/조회 |
| `player.gateway.ts` | `joining`, `moving` 이벤트 처리 |
| `entites/player.entity.ts` | Player 엔티티 |
| `dto/move.dto.ts` | 이동 데이터 DTO |
| `types/direction.type.ts` | 방향 타입 (`up`, `down`, `left`, `right`) |

### room/ (방 관리)

| 파일 | 설명 |
|------|------|
| `room.module.ts` | 방 모듈 정의 |
| `room.service.ts` | 랜덤 방 배정, 방 상태 관리 |

### task/ (태스크)

| 파일 | 설명 |
|------|------|
| `task.module.ts` | Task 모듈 정의 |
| `task.service.ts` | Task CRUD 로직 |
| `task.controller.ts` | `/api/tasks` REST 엔드포인트 |
| `entites/task.entity.ts` | Task 엔티티 |
| `dto/create-task.req.dto.ts` | Task 생성 요청 DTO |
| `dto/update-task.req.dto.ts` | Task 수정 요청 DTO |
| `dto/task.res.dto.ts` | Task 응답 DTO |
| `dto/task-list.res.dto.ts` | Task 목록 응답 DTO |

---

## Frontend 파일 상세

### app/ (페이지)

| 파일 | 설명 |
|------|------|
| `layout.tsx` | 루트 레이아웃 (HTML 구조, 폰트) |
| `page.tsx` | 메인 페이지 (게임 화면) |
| `login/page.tsx` | 로그인 페이지 (GitHub 로그인 버튼) |
| `auth/callback/page.tsx` | OAuth 콜백 처리, 메인으로 리다이렉트 |

### app/_components/ (페이지 컴포넌트)

| 파일/폴더 | 설명 |
|-----------|------|
| `TasksMenu/TasksMenu.tsx` | 태스크 메뉴 컨테이너 |
| `TasksMenu/TaskList.tsx` | 태스크 목록 |
| `TasksMenu/TaskItem.tsx` | 개별 태스크 아이템 |
| `TasksMenu/TaskTimer.tsx` | 집중 타이머 표시 |
| `UserInfoModal/index.tsx` | 사용자 정보 모달 컨테이너 |
| `UserInfoModal/tabs/ProfileTab/` | 프로필 탭 (히트맵, 통계) |
| `UserInfoModal/tabs/ActivityTab.tsx` | 활동 탭 |
| `UserInfoModal/tabs/PetTab/` | 펫 탭 (도감, 가챠) |

### _components/ (공통 컴포넌트)

| 파일 | 설명 |
|------|------|
| `AuthGuard.tsx` | 인증 상태 확인, 미인증 시 로그인 리다이렉트 |
| `ClientOnly.tsx` | SSR 방지 래퍼 (Phaser 등 클라이언트 전용) |
| `Map.tsx` | Phaser 게임 인스턴스 생성/관리 |
| `ui/button.tsx` | 버튼 컴포넌트 |
| `ui/input.tsx` | 입력 컴포넌트 |
| `ui/checkbox.tsx` | 체크박스 컴포넌트 |

### game/ (Phaser 게임 엔진)

| 파일 | 설명 |
|------|------|
| `config.ts` | Phaser 게임 설정 (물리엔진, 스케일 등) |
| `scenes/MapScene.ts` | 메인 게임 씬 (맵, 플레이어, UI 관리) |

### game/players/ (플레이어 클래스)

| 파일 | 설명 |
|------|------|
| `BasePlayer.ts` | 플레이어 기본 클래스 (스프라이트, 닉네임, 애니메이션) |
| `Player.ts` | 로컬 플레이어 (키보드 입력, 이동 이벤트 전송) |
| `RemotePlayer.ts` | 원격 플레이어 (서버 위치 동기화, Lerp 이동) |
| `Pet.ts` | 펫 클래스 |

### game/managers/ (게임 매니저)

| 파일 | 설명 |
|------|------|
| `SocketManager.ts` | 소켓 이벤트 바인딩 (`players_synced`, `moved`, `focused` 등) |
| `MapManager.ts` | 맵 로드, 충돌 영역 설정 |
| `ChatManager.ts` | 채팅 입력/표시 관리 |

### game/controllers/

| 파일 | 설명 |
|------|------|
| `CameraController.ts` | 카메라 팔로우, 줌 설정 |

### game/ui/ (게임 내 UI)

| 파일 | 설명 |
|------|------|
| `createProgressBar.ts` | 프로그레스바 생성/업데이트 |
| `createContributionList.ts` | 기여도 순위 목록 |

### stores/ (Zustand 상태)

| 파일 | 설명 |
|------|------|
| `authStore.ts` | 인증 상태 (user, isAuthenticated) |
| `userInfoStore.ts` | 사용자 프로필 정보 |
| `useTasksStore.ts` | 태스크 목록, CRUD 액션 |
| `useFocusTimeStore.ts` | 포커스타임 상태 (status, totalMinutes) |
| `pointStore.ts` | 포인트 상태 |

### lib/ (유틸리티)

| 파일 | 설명 |
|------|------|
| `api.ts` | fetch 래퍼, API 호출 함수 |
| `socket.ts` | Socket.io 클라이언트 인스턴스 |
| `devLogger.ts` | 개발용 콘솔 로거 |

### utils/

| 파일 | 설명 |
|------|------|
| `timeFormat.ts` | 시간 포맷 유틸 (분 → "1시간 30분") |

## 주요 데이터 흐름

### 1. 인증 흐름

```
사용자 → /auth/github → GitHub OAuth → /auth/github/callback → JWT 쿠키 발급 → 메인 페이지
```

### 2. 게임 접속 흐름

```
로그인 완료 → Socket.io 연결 (JWT 검증) → joining 이벤트 → 방 배정 → 기존 플레이어 동기화
```

### 3. GitHub 활동 감지 흐름

```
사용자 접속 → 폴링 시작 (30초 간격) → GraphQL API 조회 → 변경 감지 → github_event 브로드캐스트
```

### 4. 플레이어 이동 흐름

```
키보드 입력 → Phaser Physics 이동 → moving 이벤트 → 같은 방 브로드캐스트 → RemotePlayer 업데이트
```
