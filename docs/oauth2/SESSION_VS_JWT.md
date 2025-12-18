# 세션 vs JWT 비교 분석

이 프로젝트에서 JWT를 선택한 이유를 정리합니다.

## 프로젝트 특성

| 항목 | 현재 상태 |
|------|----------|
| 프론트엔드 | Next.js + Phaser (SPA 게임) |
| 백엔드 | NestJS + Socket.io |
| 실시간 통신 | Socket.io WebSocket |
| 서버 구조 | 단일 서버 |

## 비교표

| 비교 항목 | 세션 | JWT |
|----------|-----|-----|
| Socket.io 통합 | △ 추가 설정 필요 | ◎ 간편 (handshake에 토큰 포함) |
| 서버 확장성 | △ Redis 등 세션 저장소 공유 필요 | ◎ Stateless |
| 즉시 무효화 | ◎ 세션 삭제로 가능 | △ 블랙리스트 필요 |
| 구현 복잡도 | ◎ 단순 | ○ 보통 |
| **게임 서버 적합도** | ○ | **◎** |

## JWT 선택 이유

### 1. Socket.io 통합이 깔끔함

- JWT를 handshake에 포함하여 간편하게 인증
- 세션은 쿠키를 WebSocket으로 전달하기 위한 추가 설정 필요

### 2. 게임 서버 확장성

- 멀티플레이어 게임은 유저 증가 시 서버 수평 확장 필수
- JWT는 Stateless → 어떤 서버에서든 토큰 검증 가능
- 세션은 Redis 등 세션 저장소 공유 필요

### 3. NestJS의 우수한 JWT 지원

- `@nestjs/jwt`, `@nestjs/passport` 잘 갖춰져 있음

### 4. OAuth2 플로우와 자연스러운 통합

- GitHub OAuth → access_token 획득 → 자체 JWT 발급 → 클라이언트 저장
