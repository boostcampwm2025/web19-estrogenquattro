# 기술 스택

## Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| **Next.js** | 16 | React 프레임워크 (SSG 정적 빌드) |
| **React** | 19 | UI 라이브러리 |
| **TypeScript** | 5 | 타입 안전성 |
| **Phaser** | 3.90 | 2D 게임 엔진 |
| **Zustand** | 5 | 상태 관리 |
| **React Query** | 5 | 서버 상태 관리 |
| **i18next + react-i18next** | - | 다국어(i18n) |
| **Tailwind CSS** | 4 | 스타일링 |
| **Socket.io-client** | 4.8 | WebSocket 클라이언트 |

### Phaser 3 선택 이유

- 2D 게임에 특화된 성숙한 게임 엔진
- Arcade Physics로 충돌 감지 및 이동 처리
- Next.js와 통합 가능 (SSR 비활성화 필요)
- 스프라이트 시트, 타일맵 지원

### 정적 빌드 (SSG)

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'export',           // 정적 HTML 빌드
  distDir: '../backend/public' // NestJS에서 서빙
};
```

- 별도 프론트엔드 서버 불필요
- NestJS가 정적 파일 서빙
- 배포 단순화

---

## Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| **NestJS** | 11 | Node.js 프레임워크 |
| **TypeScript** | 5 | 타입 안전성 |
| **Socket.io** | 4.8 | WebSocket 서버 |
| **TypeORM** | - | ORM |
| **SQLite** | - | 데이터베이스 |
| **Passport** | - | 인증 미들웨어 |
| **Winston** | - | 로깅 |
| **Axiom** | - | 프로덕션 로그 수집 |
| **Prometheus** | - | 메트릭 |
| **Octokit** | - | GitHub 사용자/팔로우 API 연동 |

### NestJS 선택 이유

- 모듈 기반 아키텍처
- TypeScript 네이티브 지원
- WebSocket Gateway 내장
- 의존성 주입 (DI)

### SQLite 선택 이유

- 서버리스, 파일 기반 DB
- 설정 불필요
- 소규모 프로젝트에 적합
- TypeORM 마이그레이션 지원

---

## 인증

| 기술 | 용도 |
|------|------|
| **GitHub OAuth2** | 소셜 로그인 |
| **JWT** | 인증 토큰 |
| **httpOnly Cookie** | 토큰 저장 (XSS 방지) |

### OAuth Scope

```
read:user    # 프로필 조회
user:follow  # 팔로우/언팔로우
```

---

## 인프라

| 기술 | 용도 |
|------|------|
| **PM2** | 프로세스 매니저 |
| **GitHub Actions** | CI/CD |
| **pnpm** | 패키지 매니저 |

### PM2 설정

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/main.js',
      cwd: './backend',
      env_production: { NODE_ENV: 'production' }
    }
  ]
};
```

---

## 외부 API

| API | 용도 |
|-----|------|
| **GitHub REST Events API** | 사용자 활동 폴링 (커밋/PR/이슈/리뷰) |
| **GitHub REST Users API (Octokit)** | 프로필/팔로우 상태 조회 및 팔로우/언팔로우 |

### REST Events 선택 이유 (GraphQL → REST 전환)

| 항목 | GraphQL API | REST Events API |
|------|----------|-------------|
| 데이터 상세 | 집계 중심 | 이벤트 상세(레포/제목) 제공 |
| 변경 감지 | 쿼리 비교 필요 | ETag + 이벤트 ID 기준점 처리 용이 |
| Rate Limit | 5,000/hour | 5,000/hour (동일) |

---

## 개발 도구

| 도구 | 용도 |
|------|------|
| **ESLint** | 린팅 |
| **Prettier** | 코드 포맷팅 |
| **Jest** | 테스트 |
| **Tiled** | 맵 에디터 (충돌 영역 정의) |
