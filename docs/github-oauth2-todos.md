# GitHub OAuth2 구현 작업 우선순위

> Issue: [#33 feat : GitHub OAuth2 로그인 구현](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/33)

## 작업 흐름

```
OAuth App 등록 → 백엔드 인증 구축 → 프론트엔드 로그인 → Socket.io 통합
```

## Phase 1: 사전 준비 ✅

| 순서 | 작업 | 상태 |
|:---:|------|:---:|
| 1 | GitHub OAuth App 등록 (Client ID, Client Secret 발급) | ✅ |

## Phase 2: 백엔드 기반 ✅

| 순서 | 작업 | 의존성 | 상태 |
|:---:|------|--------|:---:|
| 2 | 인증 패키지 설치 (`@nestjs/jwt`, `@nestjs/passport`, `passport-github2`) | - | ✅ |
| 3 | 인메모리 사용자 저장소 구현 (Map 기반) | - | ✅ |
| 4 | Auth 모듈 생성 (`auth.module.ts`) | 2, 3 | ✅ |
| 5 | GitHub OAuth 전략 구현 (`github.strategy.ts`) | 4 | ✅ |
| 6 | JWT 전략 구현 (`jwt.strategy.ts`) | 4 | ✅ |
| 7 | Auth 컨트롤러 구현 (로그인, 콜백, 로그아웃 엔드포인트) | 5, 6 | ✅ |

## Phase 3: 프론트엔드 ✅

| 순서 | 작업 | 의존성 | 상태 |
|:---:|------|--------|:---:|
| 8 | 로그인 페이지 구현 (GitHub 로그인 버튼 포함) | 7 | ✅ |
| 9 | OAuth 콜백 페이지 구현 | 7 | ✅ |
| 10 | 인증 상태 관리 (Zustand store) | 9 | ✅ |
| 11 | 비로그인 시 로그인 페이지로 리다이렉트 처리 | 10 | ✅ |

## Phase 4: Socket.io 통합 ✅

| 순서 | 작업 | 의존성 | 상태 |
|:---:|------|--------|:---:|
| 12 | Socket.io handshake JWT 검증 Guard 추가 | 6 | ✅ |
| 13 | Socket.io 연결 시 토큰 전달 | 10, 12 | ✅ |

## 상태 범례

- ⬜ 대기
- 🔄 진행 중
- ✅ 완료

---

## 특이사항 메모

### 환경변수 관리
- `@nestjs/config` + `Joi`를 사용하여 환경변수 검증
- 필수 환경변수 누락 시 앱 시작 단계에서 즉시 에러 발생
- 설정 파일: `src/config/env.validation.ts`

### 필수 환경변수
| 변수명 | 설명 |
|-------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `JWT_SECRET` | JWT 서명용 비밀키 |

### API 엔드포인트
| 메서드 | 경로 | 설명 |
|-------|------|------|
| GET | `/auth/github` | GitHub 로그인 시작 |
| GET | `/auth/github/callback` | OAuth 콜백 |
| GET | `/auth/me` | 현재 사용자 정보 (JWT 필요) |
| GET | `/auth/logout` | 로그아웃 |

### 추가 설치 패키지

**Backend:**
```
@nestjs/config, joi, @nestjs/jwt, @nestjs/passport,
passport, passport-github2, passport-jwt, cookie-parser
```

**Frontend:**
```
socket.io-client
```

### 프론트엔드 환경변수
| 변수명 | 설명 |
|-------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API URL (기본: `http://localhost:8080`) |

### 생성된 파일 목록

**Backend:**
- `src/auth/ws-jwt.guard.ts` - Socket.io JWT 검증 Guard

**Frontend:**
- `src/app/login/page.tsx` - 로그인 페이지
- `src/app/auth/callback/page.tsx` - OAuth 콜백 페이지
- `src/stores/authStore.ts` - Zustand 인증 상태 관리
- `src/components/AuthGuard.tsx` - 인증 보호 컴포넌트
- `src/lib/socket.ts` - Socket.io 클라이언트 설정
