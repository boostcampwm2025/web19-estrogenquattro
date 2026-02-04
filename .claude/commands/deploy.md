temp/deploy 브랜치로 배포하는 명령어입니다.

다음 명령어를 순서대로 실행하세요:

```bash
git checkout temp/deploy && git pull && git merge origin/main && cd frontend && pnpm i && pnpm build && cd .. && git add backend/public && git commit -m "chore: 프론트엔드 빌드" && git push
```
