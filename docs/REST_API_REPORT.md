# GitHub Event Polling System Report

## 개요

GitHub API를 활용하여 사용자의 이벤트(커밋, 푸시, 이슈 생성 등)를 실시간으로 감지하는 폴링 시스템.

---

## 시스템 구성

| 항목 | 값 |
|------|-----|
| 대상 API | `GET /users/{username}/events/public` |
| 폴링 주기 | 300초 (5분) |
| Rate Limit | 토큰 없음: 60/hour, 토큰 있음: 5000/hour |

---

## 핵심 기술: ETag (조건부 요청)

### 동작 방식

```
[첫 번째 요청]
GET /users/username/events/public
→ 200 OK + ETag: "abc123"

[두 번째 요청]
GET /users/username/events/public
If-None-Match: "abc123"
→ 304 Not Modified (변화 없음, Rate Limit 소모 안함)
   또는
→ 200 OK + 새로운 ETag (변화 있음)
```

### 장점
- 변화가 없으면 304 응답 → Rate Limit 소모 없음
- 네트워크 대역폭 절약

---

## 실험 과정에서 발견한 문제

### 문제 상황
- Issue 생성 이벤트 발생
- API 응답: 200 (ETag 변경됨)
- 출력: "No new push"

### 원인 분석

```
ETag 변경 기준: 전체 이벤트 목록
필터링 기준: PushEvent만
```

| 항목 | 변화 여부 |
|------|----------|
| 전체 이벤트 목록 | O (Issue 추가) |
| ETag | O → 200 응답 |
| PushEvent 목록 | X (변경 없음) |
| 결과 | "No new push" |

### 해결
`filter_push_events()` 제거 → 모든 이벤트 타입 감지

---

## 코드 변경 이력

### 1차 변경: 감지 시간 + JSON 출력
```python
# Before
print(f"NEW PUSH DETECTED! ({len(new_events)})")
print(self.format_push_event(event))

# After
print(f"[{now}] NEW PUSH DETECTED! ({len(new_events)})")
print(json.dumps(event, indent=2, ensure_ascii=False))
```

### 2차 변경: 모든 이벤트 타입 감지
```python
# Before: PushEvent만 필터링
push_events = self.filter_push_events(events)
for event in push_events:
    ...

# After: 전체 이벤트 사용
for event in events:
    ...
```

---

## 최종 로직 흐름

```
┌─────────────────────────────────────┐
│         초기 이벤트 로드              │
│    last_event_id = events[0].id     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         POLL_INTERVAL 대기           │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│      API 요청 (ETag 포함)            │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
   [304 응답]           [200 응답]
   No change            이벤트 확인
        │                   │
        │         ┌─────────┴─────────┐
        │         │                   │
        │         ▼                   ▼
        │   last_event_id       last_event_id
        │   이후 이벤트 없음      이후 이벤트 있음
        │         │                   │
        │         │                   ▼
        │         │          JSON pretty print
        │         │          last_event_id 갱신
        │         │                   │
        └─────────┴─────────┬─────────┘
                            │
                            ▼
                    (반복: 대기로 돌아감)
```

---

## 감지 가능한 이벤트 타입

| 이벤트 타입 | 설명 |
|------------|------|
| PushEvent | 커밋 푸시 |
| CreateEvent | 브랜치/태그 생성 |
| DeleteEvent | 브랜치/태그 삭제 |
| IssuesEvent | 이슈 생성/수정/닫기 |
| IssueCommentEvent | 이슈 댓글 |
| PullRequestEvent | PR 생성/수정/머지 |
| WatchEvent | 스타 추가 |
| ForkEvent | 레포지토리 포크 |
| ... | 기타 |

---

## 출력 예시

```
==================================================
[17:45:30] NEW EVENT DETECTED! (1)
==================================================
{
  "id": "12345678901",
  "type": "IssuesEvent",
  "actor": {
    "login": "honki12345",
    "display_login": "honki12345"
  },
  "repo": {
    "name": "honki12345/my-repo"
  },
  "payload": {
    "action": "opened",
    "issue": {
      "number": 1,
      "title": "First issue"
    }
  },
  "created_at": "2026-01-25T08:45:30Z"
}
----------------------------------------
Rate Limit: 4999/5000
```

---

## 실험 결과 (2026-01-25)

### 실험 환경
- 대상 사용자: `honki12345`
- 대상 레포지토리: `honki12345/htdp`
- 폴링 주기: 300초 (5분)
- 초기 Rate Limit: 4998/5000
- 총 실험 시간: 약 42분

### 감지된 이벤트 타임라인

| 감지 시간 | 이벤트 타입 | Action | 상세 |
|-----------|-------------|--------|------|
| 19:20:25 | IssuesEvent | opened | Issue #2 "test2" 생성 |
| 19:20:25 | PushEvent | - | main 브랜치 푸시 (`c0860f9` → `9a46471`) |
| 19:34:18 | CreateEvent | - | 브랜치 생성 `test/minor-update-1769336830` |
| 19:34:18 | PullRequestEvent | opened | PR #3 생성 (test/minor-update → main) |
| 19:48:11 | PushEvent | - | main 브랜치 푸시 (`9a46471` → `e36e6ac`) |
| 19:48:11 | PullRequestEvent | merged | PR #3 머지 |

### 이벤트 감지 지연 시간

| 이벤트 | 발생 시간 (UTC→KST) | 감지 시간 | 지연 |
|--------|---------------------|-----------|------|
| IssuesEvent (Issue #2) | 10:13:22 → 19:13:22 | 19:20:25 | **약 7분** |
| PushEvent | 10:17:17 → 19:17:17 | 19:20:25 | **약 3분** |
| CreateEvent (브랜치) | 10:27:42 → 19:27:42 | 19:34:18 | **약 6분 30초** |
| PullRequestEvent (생성) | 10:27:51 → 19:27:51 | 19:34:18 | **약 6분 30초** |
| PullRequestEvent (머지) | 10:35:09 → 19:35:09 | 19:48:11 | **약 13분** |
| PushEvent | 10:35:10 → 19:35:10 | 19:48:11 | **약 13분** |

**평균 감지 지연: 약 8분** (폴링 주기 5분 + API 처리 시간)

### 폴링 로그 요약

| 폴링 # | 시간 | 결과 | Rate Limit |
|--------|------|------|------------|
| #1 | 19:11:11 | 304 (No change) | - |
| #2 | 19:15:47 | 304 (No change) | - |
| #3 | 19:20:25 | 200 (2 events) | 4996/5000 |
| #4 | 19:25:04 | 304 (No change) | - |
| #5 | 19:29:39 | 304 (No change) | - |
| #6 | 19:34:18 | 200 (2 events) | 4995/5000 |
| #7 | 19:38:57 | 304 (No change) | - |
| #8 | 19:43:33 | 304 (No change) | - |
| #9 | 19:48:11 | 200 (2 events) | 4999/5000 |

### 이벤트 상세 정보

#### 1. IssuesEvent (이슈 생성)
```json
{
  "type": "IssuesEvent",
  "payload": {
    "action": "opened",
    "issue": {
      "number": 2,
      "title": "test2",
      "state": "open"
    }
  }
}
```

#### 2. CreateEvent (브랜치 생성)
```json
{
  "type": "CreateEvent",
  "payload": {
    "ref": "test/minor-update-1769336830",
    "ref_type": "branch",
    "master_branch": "main"
  }
}
```

#### 3. PullRequestEvent (PR 생성 → 머지)
```json
{
  "type": "PullRequestEvent",
  "payload": {
    "action": "opened → merged",
    "number": 3,
    "pull_request": {
      "head": { "ref": "test/minor-update-1769336830" },
      "base": { "ref": "main" }
    }
  }
}
```

#### 4. PushEvent (커밋 푸시)
```json
{
  "type": "PushEvent",
  "payload": {
    "ref": "refs/heads/main",
    "before": "9a4647183f94a1f163473460ffccbb0b050762d1",
    "head": "e36e6ac262f8440ceb33aa72eb1f4581f5dda469"
  }
}
```

### 실험 결과 분석

1. **ETag 효율성**: 9회 폴링 중 6회가 304 응답 → Rate Limit 절약
2. **다양한 이벤트 감지**: IssuesEvent, CreateEvent, PullRequestEvent, PushEvent 모두 정상 감지
3. **PR 워크플로우 추적**: 브랜치 생성 → PR 생성 → PR 머지 → 푸시 전 과정 감지
4. **감지 지연**: 평균 약 8분 (폴링 주기에 비례)

---

## 결론

- ETag 기반 조건부 요청으로 Rate Limit 효율적 사용
- 모든 이벤트 타입 감지로 GitHub 활동 전체 모니터링 가능
- JSON pretty print로 응답 데이터 가독성 확보
- 폴링 방식의 한계: 실시간 감지 불가 (평균 지연 약 8분)

---

## 참고 문서

- [GitHub REST API - Events](https://docs.github.com/ko/rest/activity/events?apiVersion=2022-11-28)
- [GitHub REST API - API Versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions?apiVersion=2022-11-28)
- [GitHub REST API - Issue Events](https://docs.github.com/ko/rest/issues/events?apiVersion=2022-11-28)
- [GitHub Event Types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)
