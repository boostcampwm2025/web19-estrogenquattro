# Logging Convention

## 기본 원칙

### 1. 민감한 정보는 로깅하지 않는다

**절대 로깅하면 안 되는 정보:**
- JWT 토큰, Access Token, Refresh Token
- 비밀번호, API Key, Secret
- 쿠키 전체 내용 (`req.cookies`)
- 사용자 전체 객체 (`JSON.stringify(user)`)

**로깅 가능한 정보:**
- 사용자명 (username)
- 요청 성공/실패 여부
- 에러 메시지 (민감 정보 제외)

### 2. 로깅 예시

```typescript
// Bad - 민감 정보 노출
this.logger.log(`Cookies: ${JSON.stringify(req.cookies)}`);
this.logger.log(`User: ${JSON.stringify(user)}`);
this.logger.log(`Token: ${token}`);

// Good - 필요한 정보만 로깅
this.logger.log(`Token found: ${token ? 'yes' : 'no'}`);
this.logger.log(`Username: ${user.username}`);
this.logger.log(`User found: ${user ? 'yes' : 'no'}`);
```

## NestJS Logger 사용법

### Logger 설정

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);
}
```

### 로그 레벨

| 메서드 | 용도 | 예시 |
|--------|------|------|
| `logger.debug()` | 개발 시 상세 정보 | 토큰 존재 여부, 검증 과정 |
| `logger.log()` | 일반 정보 | 요청 처리 완료, 사용자 액션 |
| `logger.warn()` | 경고 | 잘못된 요청, 재시도 필요 |
| `logger.error()` | 에러 | 예외 발생, 실패 |

### 로그 레벨 설정

```typescript
// main.ts
const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn', 'log'], // production
  // logger: ['error', 'warn', 'log', 'debug'], // development
});
```
