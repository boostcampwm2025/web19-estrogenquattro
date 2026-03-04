# CLI 안전 컨벤션

쉘 명령 실행 시 문자열 해석/이스케이프 오류로 인한 오동작을 방지하기 위한 공통 규칙입니다.
PR 작성뿐 아니라 `gh`, `curl`, `jq`, `sed`, SQL/JSON payload 작업 전반에 적용합니다.

## 핵심 원칙

1. **명령과 데이터 분리**
   - 복잡한 본문/JSON/쿼리는 명령 인자로 직접 넣지 말고 파일로 분리한다.
2. **멀티라인 데이터는 quoted heredoc 사용**
   - `<<'EOF'` 형태를 기본으로 사용한다.
3. **본문/페이로드는 file-based 옵션 우선**
   - `--body-file`, `--input`, `-d @file`를 기본으로 사용한다.
4. **쉘 해석이 필요한 경우를 최소화**
   - 백틱, `$()`, 글롭(`*`), 따옴표 중첩을 인라인 인자에서 피한다.
5. **실행 후 반드시 검증**
   - 생성/수정 직후 조회 명령으로 결과를 확인한다.

## 위험 패턴

아래 문자가 포함된 데이터를 인라인으로 넘기면 실패 위험이 높습니다.

- 백틱: `` ` ``
- 명령 치환: `$()`
- 변수 확장: `$VAR`
- 제어 문자: `;`, `|`, `&&`, `>`, `<`
- 글롭: `*`, `?`, `[ ... ]`
- 따옴표 중첩: `'`, `"`

## 금지 패턴

```bash
# 1) 백틱 포함 본문을 인라인 전달
gh pr create --body "본문에 `code` 포함"

# 2) JSON을 인라인 문자열로 직접 조합
curl -X POST -d "{\"body\":\"$CONTENT\"}" ...

# 3) eval로 동적 명령 실행
eval "$CMD"
```

## 권장 패턴

### 1) 텍스트 본문

```bash
cat > /tmp/body.md <<'EOF'
## 작업 내용
- `code`/특수문자/멀티라인 포함
EOF

gh pr create --title "fix: ..." --body-file /tmp/body.md
gh pr edit 123 --body-file /tmp/body.md
```

### 2) JSON payload

```bash
cat > /tmp/payload.json <<'EOF'
{
  "title": "fix: ...",
  "body": "멀티라인\n본문"
}
EOF

curl -X POST -H "Content-Type: application/json" --data @/tmp/payload.json https://api.example.com/...
```

### 3) `jq`/`gh api`에서 문자열 주입

```bash
# jq --arg 사용으로 안전하게 주입
jq --arg body "$BODY_TEXT" '.body = $body' template.json > /tmp/payload.json

# gh api도 --input 파일 사용
gh api repos/{owner}/{repo}/pulls/{pr} -X PATCH --input /tmp/payload.json
```

## 실행 체크리스트

1. 인라인 인자에 백틱/`$()`/멀티라인이 있는가?
2. 있다면 파일 기반 전달로 바꿨는가?
3. heredoc은 `<<'EOF'`인가?
4. 실행 직후 조회로 결과를 검증했는가?

## 장애 발생 시 표준 복구

1. 즉시 중단하고 실패 명령을 반복 실행하지 않는다.
2. 인라인 문자열을 파일 기반 전달 방식으로 전환한다.
3. 동일 기능을 다시 실행하고 결과를 조회로 검증한다.
4. 원인을 작업 로그에 남긴다. (무엇이 쉘 해석되었는지)

## 권장 명령 템플릿

```bash
# 안전한 텍스트 전달 템플릿
cat > /tmp/<name>.txt <<'EOF'
<content>
EOF
<command> --body-file /tmp/<name>.txt

# 안전한 JSON 전달 템플릿
cat > /tmp/<name>.json <<'EOF'
{ ... }
EOF
<command> --input /tmp/<name>.json
```

