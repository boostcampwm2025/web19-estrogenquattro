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
│  ├─ PlayerModule    : 플레이어 프로필, 이동                       │
│  ├─ ChatModule      : 채팅 브로드캐스팅                          │
│  ├─ GithubModule    : GitHub GraphQL 폴링                        │
│  ├─ RoomModule      : 랜덤 방 배정                               │
│  ├─ TaskModule      : Task CRUD                                  │
│  ├─ FocusTimeModule : 집중 시간 관리                             │
│  ├─ PointModule     : 포인트 시스템                              │
│  └─ UserPetModule   : 펫 시스템                                  │
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
│   │   ├── focustime/      # 집중 시간 관리
│   │   ├── github/         # GitHub 폴링
│   │   ├── player/         # 플레이어 관리
│   │   ├── point/          # 포인트 시스템
│   │   ├── room/           # 방 관리
│   │   ├── task/           # Task CRUD
│   │   └── userpet/        # 펫 시스템
│   └── public/             # 프론트엔드 빌드 결과물 (정적 서빙)
│
├── frontend/               # Next.js 프론트엔드
│   ├── src/
│   │   ├── _components/   # 공통 UI 컴포넌트
│   │   ├── app/           # 페이지
│   │   ├── game/          # Phaser 게임 엔진
│   │   │   ├── constants/ # 게임 상수
│   │   │   ├── controllers/ # 카메라 컨트롤러 등
│   │   │   ├── managers/  # SocketManager, MapManager 등
│   │   │   ├── players/   # Player, RemotePlayer, Pet
│   │   │   ├── scenes/    # MapScene
│   │   │   ├── types/     # 타입 정의
│   │   │   └── ui/        # 게임 내 UI
│   │   ├── lib/           # API, 유틸리티
│   │   ├── stores/        # Zustand 상태 관리
│   │   └── utils/         # 헬퍼 함수
│   └── public/            # 정적 에셋 (맵, 스프라이트)
│
└── docs/                  # 문서
```

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
