# 마크다운 컨벤션

## 코드 블록 언어 지정

모든 fenced code block에는 **언어를 반드시 지정**합니다.

### 언어 지정 목록

| 용도 | 언어 지정 | 예시 |
|------|----------|------|
| TypeScript | `typescript` 또는 `ts` | 코드 예시 |
| JavaScript | `javascript` 또는 `js` | 코드 예시 |
| JSON | `json` | 설정 파일, API 응답 |
| Bash/Shell | `bash` 또는 `sh` | 명령어 |
| SQL | `sql` | 쿼리 |
| HTML | `html` | 마크업 |
| CSS | `css` | 스타일 |
| YAML | `yaml` | 설정 파일 |
| Markdown | `markdown` 또는 `md` | 마크다운 예시 |
| Mermaid | `mermaid` | 다이어그램 |
| 디렉토리 구조 | `text` | 폴더/파일 트리 |
| 일반 텍스트 | `text` | 언어 특정 불가 시 |
| 환경변수 | `env` 또는 `text` | .env 파일 |
| 로그 출력 | `text` | 로그, 출력 결과 |

### 예시

**좋은 예:**

~~~markdown
```typescript
const greeting = "Hello, World!";
```
~~~

~~~markdown
```text
.
├── src/
│   ├── app/
│   └── components/
└── package.json
```
~~~

~~~markdown
```bash
pnpm install
pnpm dev
```
~~~

**나쁜 예:**

~~~markdown
```
const greeting = "Hello, World!";
```
~~~

언어 지정이 없으면:
- 구문 강조(Syntax Highlighting)가 적용되지 않음
- Markdown 린터 경고 발생
- 코드 가독성 저하

---

## 이미지 링크

이미지를 클릭 가능하게 만들려면 `<a>` 태그로 `<img>`를 감쌉니다.

**좋은 예:**

```html
<a href="https://example.com">
  <img src="image.png" alt="설명" />
</a>
```

**나쁜 예:**

```html
<!-- img 태그는 href 속성을 지원하지 않음 -->
<img href="https://example.com" src="image.png" />
```

---

## 테이블

- 헤더와 구분선 필수
- 정렬이 필요하면 `:` 사용

```markdown
| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
|:----------|:-----------:|------------:|
| 내용 | 내용 | 내용 |
```

---

## 링크

- 상대 경로 우선 사용 (같은 레포지토리 내)
- 외부 링크는 절대 경로 사용

```markdown
<!-- 같은 레포 내 문서 -->
[개발 가이드](./docs/guides/DEVELOPMENT.md)

<!-- 외부 링크 -->
[GitHub](https://github.com)
```
