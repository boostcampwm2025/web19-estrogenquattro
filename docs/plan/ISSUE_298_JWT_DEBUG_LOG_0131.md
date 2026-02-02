# Issue #298: JwtStrategy DEBUG 로그 과다 출력 개선

## 문제 분석

### 현상

프로필 확인 시 JwtStrategy DEBUG 로그가 4번씩 반복 출력됨

```
[JwtStrategy] Extracting token from cookies: found
[JwtStrategy] Validating payload for user: honki12345
[JwtStrategy] User found: yes
```

### 원인

**1. DEBUG 레벨 로그 3개 존재**

```typescript
// backend/src/auth/jwt.strategy.ts:25-27
this.logger.debug(`Extracting token from cookies: ${token ? 'found' : 'not found'}`);

// backend/src/auth/jwt.strategy.ts:36-38
this.logger.debug(`Validating payload for user: ${payload.username}`);
this.logger.debug(`User found: ${user ? 'yes' : 'no'}`);
```

**2. JwtGuard를 사용하는 컨트롤러가 다수**

```
- /auth/me (AuthController)
- /api/tasks (TaskController)
- /api/focustime (FocusTimeController)
- /api/players (PlayerController)
- /api/points (PointController)
- /api/point-history (PointHistoryController)
- /api/userpet (PetController)
- /api/git-histories (GithubController)
```

페이지 로드 시 여러 API가 동시 호출되어 JWT 검증이 여러 번 실행됨

---

## 해결 방안

### 방안 A: DEBUG 로그 레벨 조정 (권장)

개발 환경에서도 불필요하게 반복되는 로그를 `verbose` 레벨로 낮춤

```typescript
// 변경 전
this.logger.debug(`Extracting token from cookies: ...`);

// 변경 후
this.logger.verbose(`Extracting token from cookies: ...`);
```

**장점:**
- 필요 시 로그 레벨 설정으로 다시 확인 가능
- 운영 환경에서 불필요한 로그 제거

### 방안 B: 로그 완전 제거

DEBUG 로그가 디버깅 목적으로 더 이상 필요하지 않다면 제거

```typescript
// 삭제
this.logger.debug(...);
```

### 방안 C: 프론트엔드 API 호출 최적화 (추가 조사 필요)

프론트엔드에서 불필요한 중복 API 호출이 있는지 확인
- React Query 캐싱 활용 여부
- 동일 데이터 중복 fetch 여부

---

## 구현 계획

### 1단계: DEBUG 로그 레벨 조정

**파일:** `backend/src/auth/jwt.strategy.ts`

- `logger.debug()` → `logger.verbose()` 변경
- 또는 로그 완전 제거 (팀 논의 필요)

### 2단계: (선택) 프론트엔드 API 호출 점검

**확인 사항:**
- 페이지 로드 시 호출되는 API 목록
- React Query 캐싱 설정 확인
- 불필요한 중복 호출 여부

---

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/auth/jwt.strategy.ts` | DEBUG 로그 레벨 조정 또는 제거 |

---

## 참고

- NestJS Logger 레벨: `error` < `warn` < `log` < `debug` < `verbose`
- 운영 환경에서는 보통 `log` 레벨까지만 출력
