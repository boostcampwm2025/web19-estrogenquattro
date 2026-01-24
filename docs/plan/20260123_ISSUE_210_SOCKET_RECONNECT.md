# Issue #210: 서버 연결 끊김 시 자동 재연결 안됨

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#210](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/210) |
| 제목 | 서버 연결 끊김 시 자동 재연결이 되지 않음 |
| 영역 | Frontend |
| 브랜치 | `fix/socket-auto-reconnect` |

---

## 참조한 문서

- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): Socket.io 연결 설정 및 연결 끊김 처리

---

## 문제 상황

**재현 방법:**
1. 게임에 접속
2. 서버가 재시작되거나 네트워크가 일시적으로 끊김
3. "서버와의 연결이 끊어졌습니다. 재연결 시도 중..." 메시지 표시
4. 실제 재연결은 되지 않음 (reconnection 옵션 없음)

**예상 동작:**
- 연결이 끊기면 사용자에게 명확히 알리고 새로고침 유도

---

## 해결 방안: 수동 새로고침 유도

자동 재연결 대신 수동 새로고침 방식 선택 이유:
- 구현 복잡도 낮음
- 상태 불일치 위험 없음 (새로고침 시 깨끗한 시작)
- 재연결 후 상태 동기화 버그 가능성 제거

---

## 상세 구현

### Step 1: socket.ts 수정

**파일:** `frontend/src/lib/socket.ts`

reconnection 비활성화 명시:

```typescript
socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: false,
  reconnection: false,  // 자동 재연결 비활성화
});
```

### Step 2: MapScene.ts 수정

**파일:** `frontend/src/game/scenes/MapScene.ts`

메시지 변경 + 새로고침 버튼 추가:

```typescript
private showConnectionLostOverlay() {
  if (this.connectionLostOverlay) return;

  // 오버레이 배경
  this.connectionLostOverlay = this.add.rectangle(
    this.cameras.main.centerX,
    this.cameras.main.centerY,
    this.cameras.main.width,
    this.cameras.main.height,
    0x000000,
    0.7,
  );
  this.connectionLostOverlay.setScrollFactor(0);
  this.connectionLostOverlay.setDepth(1000);

  // 메시지
  this.connectionLostText = this.add.text(
    this.cameras.main.centerX,
    this.cameras.main.centerY - 30,
    "서버와의 연결이 끊어졌습니다.",
    { fontSize: "24px", color: "#ffffff", align: "center" },
  );
  this.connectionLostText.setOrigin(0.5);
  this.connectionLostText.setScrollFactor(0);
  this.connectionLostText.setDepth(1001);

  // 새로고침 버튼
  this.connectionLostButton = this.add.text(
    this.cameras.main.centerX,
    this.cameras.main.centerY + 30,
    "[ 새로고침 ]",
    { fontSize: "20px", color: "#4ade80", align: "center" },
  );
  this.connectionLostButton.setOrigin(0.5);
  this.connectionLostButton.setScrollFactor(0);
  this.connectionLostButton.setDepth(1001);
  this.connectionLostButton.setInteractive({ useHandCursor: true });
  this.connectionLostButton.on("pointerup", () => window.location.reload());
}
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/lib/socket.ts` | `reconnection: false` 명시 |
| `frontend/src/game/scenes/MapScene.ts` | 메시지 변경 + 새로고침 버튼 추가 |

---

## 테스트 계획

### CI 테스트
```bash
cd frontend && pnpm lint && pnpm format && pnpm build && pnpm test --run
```

### 수동 테스트
- [ ] 서버 재시작 시 "서버와의 연결이 끊어졌습니다." 메시지 표시
- [ ] "새로고침" 버튼 클릭 시 페이지 새로고침
- [ ] 새로고침 후 정상 접속 확인

---

## 커밋 계획

```bash
git checkout -b fix/socket-auto-reconnect

git commit -m "$(cat <<'EOF'
fix: 서버 연결 끊김 시 새로고침 버튼 추가

- reconnection: false 명시하여 자동 재연결 비활성화
- 연결 끊김 메시지 변경 및 새로고침 버튼 추가

close #210

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## PR 정보

**제목:** `fix: 서버 연결 끊김 시 새로고침 버튼 추가`

**본문:**
```markdown
## 🔗 관련 이슈
- close: #210

## ✅ 작업 내용
- `reconnection: false` 명시하여 자동 재연결 비활성화
- 연결 끊김 시 "새로고침" 버튼 표시
- 버튼 클릭 시 페이지 새로고침

## 💡 체크리스트
- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?
```

---

## 관련 문서

- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md) - Socket.io 연결 설정 및 이벤트 명세
