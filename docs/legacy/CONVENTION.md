# 컨벤션

## 코드 컨벤션

### 공통 규칙

- **Prettier**를 사용하여 코드 포맷을 자동으로 통일합니다.
- **ESLint**를 통해 코드 품질 및 규칙을 검사합니다.
- **Husky pre-commit hook**을 적용하여 커밋 전 ESLint 검사를 자동 실행합니다.
- 네이밍 컨벤션은 팀 내 합의된 규칙을 따릅니다.

---

### 프론트엔드 컨벤션

**컴포넌트 작성 스타일**

- 컴포넌트는 `function` 키워드를 사용하여 선언합니다.
- 컴포넌트는 **파일 하단에서 `export default` 방식으로 내보냅니다.**

```jsx
function MyComponent(props) {
  // ...
}

export default MyComponent
```

---

**컴포넌트 외 코드 작성 스타일**

- 유틸리티 함수, 이벤트 핸들러 등 **컴포넌트가 아닌 일반 함수**는
화살표 함수(`const func = () => {}`)를 사용합니다.
- 훅, 유틸 함수 등은 **`export` 키워드를 사용하여 인라인으로 내보냅니다.**

```jsx
export const useMyHook = () => { /* ... */ }
```

---

### TypeScript 타입 정의 규칙

**컴포넌트 Props 타입**

- **이름 규칙**: `{컴포넌트명}Props` (예: `MyButtonProps`)
- **위치**: 해당 컴포넌트 파일 상단, 컴포넌트 선언 바로 위에 작성합니다.

**API 응답 데이터 타입**

- **관리 위치**: `src/types` 또는 `src/api/types` 등 **공용 타입 폴더**에서 관리합니다.
- 재사용성을 고려하여 컴포넌트 내부에 정의하지 않습니다.

**함수 타입 정의**

- **인자(Arguments)**:
함수 선언부 바로 위에 `type` 또는 `interface`로 정의합니다.
- **반환 값(Return)**:
    - 타입 추론이 명확한 경우 TypeScript의 추론에 맡깁니다.
    - 복잡한 객체를 반환하거나 재사용되는 훅/유틸 함수의 경우 **반환 타입을 명시적으로 작성**하여 가독성을 높입니다.

---

### 백엔드 컨벤션

- DTO 네이밍
    - `~Req`, `~Res`
    - ex) `CreateUserReq`
- 예외(에러) 객체 네이밍
    - `~Error`
    - ex) `CreateUserError`

---

## 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 폴더 (Components) | PascalCase | MyButton, CommonLayout |
| 폴더 (기타) | kebab-case | hooks, utils, api |
| 파일 (Components) | PascalCase | MyButton.tsx, Header.jsx |
| 파일 (Hooks) | camelCase | useUserData.ts |
| 파일 (기타) | camelCase | formatDate.js, apiClient.ts |
| 컴포넌트 / 클래스 / 인터페이스 | PascalCase | function MyButton() |
| 함수 / 변수 / 메서드 | camelCase | const itemCount = 0; |
| 상수 (Constants) | UPPER_SNAKE_CASE | const MAX_USER_COUNT = 10; |

