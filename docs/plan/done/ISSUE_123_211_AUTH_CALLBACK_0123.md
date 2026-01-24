# Issue #123, #211: auth/callback 페이지 버그 수정

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#123](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/123), [#211](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/211) |
| 제목 | OAuth 로그인 후 URL 문제 + callback 페이지 폰트 preload 경고 |
| 우선순위 | Quick Win (1단계) |
| 난이도 | 쉬움 |
| 브랜치 | `fix/auth-callback-url` |

---

## 참조한 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md): OAuth 인증 흐름 및 callback 페이지 역할
- [WEEKEND_BUGS.md](./20260123_WEEKEND_BUGS.md): 버그 목록 및 작업 순서

---

## 문제 상황

### #123: OAuth 로그인 후 URL 문제

**재현 방법:**
1. `/login` 페이지에서 GitHub 로그인 클릭
2. GitHub 인증 완료
3. `/auth/callback` 페이지로 리다이렉트
4. 메인 페이지(`/`)로 이동하지만 **URL이 `/auth/callback/`으로 남아있음**

**원인 1 - 개발 환경:**
- Hydration 타이밍 이슈로 인해 간헐적으로 발생
- `fetchUser()` API 응답이 빠를 경우, Next.js 라우터 hydration이 완료되기 전에 `router.replace()`가 호출됨
- 라우터가 준비되지 않은 상태에서 호출되면 URL 업데이트가 실패할 수 있음

**원인 2 - 프로덕션 빌드 환경 (백엔드 정적 파일 서빙):**
- Next.js 정적 빌드 시 `auth/callback/` 디렉토리가 생성되지만 `index.html`이 없음
- NestJS ServeStaticModule이 디렉토리 발견 시 `/auth/callback/`로 리다이렉트
- `auth/callback/index.html`이 없어서 루트 `index.html`(메인 페이지)이 반환됨
- 결과적으로 메인 페이지가 로드되지만 URL은 `/auth/callback/`으로 유지

**현재 코드:**
```typescript
// frontend/src/app/auth/callback/page.tsx
router.replace("/");
router.replace("/login");
```

### #211: callback 페이지 폰트 preload 경고

**재현 방법:**
1. GitHub 로그인 후 `/auth/callback` 페이지 진입
2. 브라우저 콘솔에서 경고 확인:
   ```
   The resource ... was preloaded using link preload but not used within a few seconds
   ```

**원인:**
- RootLayout에서 `next/font`로 Geist 폰트가 preload됨
- callback 페이지는 즉시 리다이렉트되어 폰트를 사용하지 않음
- 브라우저가 "preload했지만 사용하지 않음" 경고 발생

---

## 해결 방안

### #123 해결: window.location.replace 사용

`router.replace()` 대신 `window.location.replace()`를 사용하여 브라우저 네이티브 리다이렉트 수행

**변경 전:**
```typescript
if (isAuthenticated) {
  router.replace("/");
} else {
  router.replace("/login");
}
```

**변경 후:**
```typescript
if (isAuthenticated) {
  window.location.replace("/");
} else {
  window.location.replace("/login");
}
```

**장점:**
- 브라우저 네이티브 동작으로 Next.js hydration 상태와 무관하게 URL이 확실히 변경됨

**단점:**
- 전체 페이지 리로드 발생 (클라이언트 상태 초기화)
- 하지만 auth/callback은 상태가 없는 중간 페이지이므로 문제없음

### #123 추가 해결: 프로덕션 빌드 환경 대응

`window.location.replace()` 수정만으로는 프로덕션 빌드 환경에서 문제가 해결되지 않음.

**추가 수정 1 - Next.js 설정:**
```typescript
// frontend/next.config.ts
const nextConfig: NextConfig = {
  // ...
  trailingSlash: true,  // 추가
};
```
- 빌드 시 `auth/callback/index.html` 자동 생성
- `/auth/callback/` 요청 시 올바른 페이지 반환

**추가 수정 2 - NestJS 설정:**
```typescript
// backend/src/app.module.ts
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public'),
  // ...
  serveStaticOptions: {
    extensions: ['html'],  // 추가
  },
}),
```
- `/auth/callback` 요청 시 `auth/callback.html` 파일 탐색

### #211 해결: Won't Fix (무시)

**결론:** 해결하지 않음

**이유:**
- `next/font`는 RootLayout 수준에서 `<head>`에 preload 링크를 삽입
- 하위 layout을 생성해도 폰트 preload를 차단/제거할 수 없음
- 기능적 문제 없음 - 경고일 뿐 실제 동작에 영향 없음
- callback 페이지는 사용자에게 잠깐만 보이는 중간 페이지

---

## 상세 구현

### callback/page.tsx 수정 (#123)

**파일:** `frontend/src/app/auth/callback/page.tsx`

**변경 전:**
```typescript
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { fetchUser, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/");
      } else {
        router.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-white" />
        <p className="text-white">인증 확인 중...</p>
      </div>
    </div>
  );
}
```

**변경 후:**
```typescript
"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function AuthCallbackPage() {
  const { fetchUser, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        window.location.replace("/");
      } else {
        window.location.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-white" />
        <p className="text-white">인증 확인 중...</p>
      </div>
    </div>
  );
}
```

**변경 사항:**
- `useRouter` import 제거
- `router` 변수 제거
- `router.replace()` → `window.location.replace()`
- useEffect 의존성 배열에서 `router` 제거

---

## 수정 파일 목록

| 파일 | 변경 내용 | 이슈 |
|------|----------|------|
| `frontend/src/app/auth/callback/page.tsx` | router.replace → window.location.replace | #123 |
| `frontend/next.config.ts` | trailingSlash: true 추가 | #123 |
| `backend/src/app.module.ts` | serveStaticOptions.extensions: ['html'] 추가 | #123 |

---

## 테스트 계획

### 수동 테스트

- [ ] GitHub 로그인 후 메인 페이지로 이동
- [ ] URL이 `/`로 정상 표시되는지 확인
- [ ] 브라우저 뒤로가기 시 `/auth/callback`으로 돌아가지 않는지 확인
- [ ] 인증 실패 시 `/login`으로 이동하고 URL이 정상 표시되는지 확인

### CI 테스트

```bash
# Frontend CI
cd frontend && pnpm lint && pnpm format && pnpm build && pnpm test --run
```

---

## 커밋 계획

```bash
# 브랜치 생성
git checkout -b fix/auth-callback-url

# 커밋
git commit -m "fix: OAuth 로그인 후 URL이 /auth/callback으로 남는 문제 수정

window.location.replace()를 사용하여 브라우저 네이티브 리다이렉트 수행
hydration 타이밍과 무관하게 URL이 확실히 변경됨

close #123"
```

---

## PR 정보

**제목:** `fix: OAuth 로그인 후 URL이 /auth/callback으로 남는 문제 수정`

**본문:**
```markdown
## 🔗 관련 이슈
- close: #123

## ✅ 작업 내용
- OAuth 로그인 후 URL이 `/auth/callback/`으로 남는 문제 수정
  - `router.replace()` → `window.location.replace()` 변경
  - hydration 타이밍 이슈로 인한 간헐적 URL 미변경 문제 해결

## 💡 체크리스트
- [x] PR 제목을 형식에 맞게 작성했나요?
- [x] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?
```

---

## 관련 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md) - OAuth 인증 흐름
- [WEEKEND_BUGS.md](./20260123_WEEKEND_BUGS.md) - 주말 버그 목록
