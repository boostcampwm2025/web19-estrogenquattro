# Issue #212: REST API 401 응답 시 재로그인 유도

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#212](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/212) |
| 제목 | REST API 401 응답 시 재로그인 유도 처리 필요 |
| 영역 | Frontend |
| 브랜치 | `fix/#212-401-relogin` |

---

## 참조한 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md): JWT 인증 흐름, 토큰 만료 처리

---

## 문제 상황

**재현 방법:**

1. 로그인 후 게임 접속
2. 24시간 경과하여 JWT 토큰 만료
3. Task 생성/수정 등 REST API 호출
4. 401 응답 → 단순 에러 메시지만 표시

**예상 동작:**

- 401 응답 시 바로 로그인 페이지로 리다이렉트

---

## 원인 분석

`frontend/src/lib/api/client.ts`에서 401 응답에 대한 특수 처리 없음:

```typescript
// 현재 코드
if (!response.ok) {
  let errorMessage = `API Error: ${response.status}`;
  // 401에 대한 특수 처리 없음
  throw new Error(errorMessage);
}
```

---

## 해결 방안

**fetchApi에서 401 응답 감지 시 바로 `/login`으로 리다이렉트**

- 별도 안내 UI 없이 최대한 빠르게 이동 (에러가 잠깐 보일 수 있음)
- 중앙 집중식 처리로 모든 API 호출에 자동 적용
- `typeof window !== 'undefined'` 가드로 SSR 환경에서 reference error 방지
- 리다이렉트 후 throw로 finally 블록 실행 보장

> **Note:** `/login`은 프론트엔드 로그인 페이지로, 여기서 `/auth/github`로 리다이렉트됨
>
> **Note:** fetchApi는 클라이언트에서만 호출되는 것을 전제로 함
>
> **Note:** 리다이렉트 전 짧은 순간(수십ms) 에러 메시지가 표시될 수 있으나, 페이지가 즉시 이동하므로 사용자 경험에 큰 영향 없음

---

## 영향 범위 분석

### fetchApi를 사용하는 API (401 처리 대상)

| 파일 | API 함수 |
|------|----------|
| `lib/api/task.ts` | getTasks, createTask, updateTask, completeTask, uncompleteTask, deleteTask |
| `lib/api/focustime.ts` | getFocusTime |
| `lib/api/github.ts` | getEvents |
| `lib/api/point.ts` | getPoints |
| `lib/api/pet.ts` | getInventory, gacha, feed, evolve, equipPet, getCodex, getAllPets, getPlayer |

### 로그인 흐름 - 사이드이펙트 없음

| 페이지 | fetchApi 사용 | 영향 |
|--------|--------------|------|
| `/login` | ❌ 없음 | 안전 |
| `/auth/callback` | ❌ 없음 (raw fetch 사용) | 안전 |
| `/` (게임) | AuthGuard에서 보호 | 로그인 전에는 접근 불가 |

> **Note:** `authStore.fetchUser()`는 raw fetch를 사용하므로 fetchApi 수정에 영향받지 않음

---

## 상세 구현

### fetchApi에서 401 감지 및 리다이렉트

**파일:** `frontend/src/lib/api/client.ts`

**변경 전:**

```typescript
if (!response.ok) {
  let errorMessage = `API Error: ${response.status}`;
  // ...
  throw new Error(errorMessage);
}
```

**변경 후:**

```typescript
if (!response.ok) {
  // 401 Unauthorized - 토큰 만료 → 바로 로그인 페이지로 이동
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  let errorMessage = `API Error: ${response.status}`;
  // ...
  throw new Error(errorMessage);
}
```

**설계 포인트:**

- `typeof window !== 'undefined'`: SSR/테스트 환경에서 안전하게 동작
- `throw new Error('Unauthorized')`: finally 블록 실행 보장 (cleanup 가능)
- 리다이렉트 후 페이지가 곧 이동하므로 에러 메시지가 잠깐 보이더라도 지속되지 않음

### throw 발생 시 동작

| 호출 패턴 | 동작 |
|----------|------|
| **Zustand store** | catch에서 `set({ error })` → finally에서 cleanup → 페이지 이동으로 에러가 잠깐 보일 수 있음 |
| **React Query** | isError=true → 페이지 이동으로 에러가 잠깐 보일 수 있음 |

### 401이 발생하는 상황

| 상황 | 설명 |
|------|------|
| JWT 토큰 만료 | 24시간 경과 후 API 호출 |
| 쿠키 삭제 | 브라우저에서 수동 삭제 또는 쿠키 만료 |
| 서버 재시작 | JWT 시크릿 변경 시 기존 토큰 무효화 |

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/lib/api/client.ts` | 401 응답 시 `/login` 리다이렉트 추가 |

---

## 테스트 계획

### CI 테스트

```bash
cd frontend && pnpm lint && pnpm format && pnpm build && pnpm test --run
```

### 수동 테스트

- [ ] 브라우저 개발자 도구에서 쿠키 삭제 후 API 호출
- [ ] 401 응답 시 `/login` 페이지로 즉시 이동 확인
- [ ] 정상 인증 상태에서는 API 호출이 정상 동작하는지 확인
- [ ] 처음 접속 사용자 로그인 흐름에 영향 없는지 확인

### 자동화 테스트 미작성 사유

- 변경 범위가 작음 (client.ts 한 파일, 5줄 이내)
- `window.location.href` 리다이렉트는 jsdom에서 모킹이 복잡
- 브라우저에서 직접 확인이 가장 확실한 검증 방법
- 기존 테스트가 fetchApi의 정상 동작(200 응답)을 커버

---

## 커밋 계획

```bash
git checkout -b fix/#212-401-relogin

git commit -m "$(cat <<'EOF'
fix: REST API 401 응답 시 로그인 페이지로 리다이렉트

- fetchApi에서 401 응답 감지 시 /login으로 즉시 이동
- typeof window 가드로 SSR 환경 대응

close #212

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## PR 정보

**제목:** `fix: REST API 401 응답 시 로그인 페이지로 리다이렉트`

**본문:**

```markdown
## 🔗 관련 이슈
- close: #212

## ✅ 작업 내용
- fetchApi에서 401 응답 감지 시 `/login`으로 즉시 리다이렉트
- `typeof window` 가드로 SSR 환경 대응

## 🧪 테스트
- 쿠키 삭제 후 API 호출 시 로그인 페이지로 이동 확인
- 처음 접속 사용자 로그인 흐름에 영향 없음 확인

## 💡 체크리스트
- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?
```

---

## 관련 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md) - 인증 흐름
- [WEEKEND_BUGS.md](./20260123_WEEKEND_BUGS.md) - 주말 버그 목록
