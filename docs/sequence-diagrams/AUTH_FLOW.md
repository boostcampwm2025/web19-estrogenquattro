# GitHub OAuth2 인증 흐름 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Frontend as Frontend<br/>(Next.js)
    participant Backend as Backend<br/>(NestJS)
    participant GitHub as GitHub<br/>OAuth Server

    Note over User, GitHub: 1. 로그인 시작
    User->>Frontend: /login 페이지 접속
    Frontend-->>User: 로그인 페이지 렌더링<br/>(GitHub 로그인 버튼)

    Note over User, GitHub: 2. GitHub OAuth 인증 요청
    User->>Frontend: "GitHub로 로그인" 클릭
    Frontend->>Backend: GET /auth/github
    Backend->>GitHub: 리다이렉트<br/>(client_id, redirect_uri, scope)
    GitHub-->>User: GitHub 로그인 페이지

    Note over User, GitHub: 3. GitHub 인증 및 콜백
    User->>GitHub: GitHub 계정으로 인증
    GitHub->>Backend: GET /auth/github/callback<br/>(code)
    Backend->>GitHub: POST /login/oauth/access_token<br/>(code, client_id, client_secret)
    GitHub-->>Backend: access_token
    Backend->>GitHub: GET /user<br/>(access_token)
    GitHub-->>Backend: 사용자 정보<br/>(id, login, avatar_url)

    Note over User, GitHub: 4. JWT 발급 및 리다이렉트
    Backend->>Backend: 사용자 저장 (UserStore)
    Backend->>Backend: JWT 토큰 생성
    Backend->>Frontend: 리다이렉트 /auth/callback<br/>+ Set-Cookie: access_token (httpOnly)

    Note over User, GitHub: 5. 인증 확인 및 완료
    Frontend->>Backend: GET /auth/me<br/>(Cookie: access_token)
    Backend->>Backend: JWT 검증
    Backend-->>Frontend: 사용자 정보<br/>{sub, username}
    Frontend->>Frontend: Zustand Store 업데이트
    Frontend-->>User: 메인 페이지로 리다이렉트 (/)
```

## 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|-------|------|------|
| GET | `/auth/github` | GitHub 로그인 시작 (리다이렉트) |
| GET | `/auth/github/callback` | OAuth 콜백 처리 + JWT 쿠키 설정 |
| GET | `/auth/me` | 현재 사용자 정보 조회 (JWT 필요) |
| GET | `/auth/logout` | 로그아웃 (쿠키 삭제) |

## 인증 상태 관리

- **Backend**: httpOnly 쿠키에 JWT 저장 (XSS 방지)
- **Frontend**: Zustand store로 인증 상태 관리
- **보호된 페이지**: AuthGuard 컴포넌트로 비로그인 시 /login으로 리다이렉트
