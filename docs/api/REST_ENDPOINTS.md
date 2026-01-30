# REST API 엔드포인트

## Base URL

```
개발: http://localhost:8080
```

---

## 상태

- **Implemented:** 아래 본문에 상세 설명된 엔드포인트
- **Planned:** 후보 단계
- **Optional:** 선택 기능

### 후보 엔드포인트

| API | 목적 | 상태 | 비고 |
| --- | --- | --- | --- |
| `GET /api/players/me` | 내 프로필 조회 | Planned | |
| `PATCH /api/players/me` | 닉네임/대표펫 변경 | Planned | |
| `GET /api/players/:id` | 공개 프로필 조회 | Planned | |
| `GET /api/pets` | 펫 도감(마스터) | Planned | |
| `GET /api/pets/me` | 보유 펫 목록/경험치 | Planned | |
| `PATCH /api/players/me` | 대표 펫 설정 | Optional | 본문 필드로 처리 |
| `POST /api/pet-draws` | 펫 뽑기 | Optional | 기존 액션형 `POST /api/pets/draw` 대체 |
| `GET /api/tasks/daily-counts` | 일별 완료 Task 개수 | Planned | 히트맵 집계 |
| `GET /api/focus-time?date=YYYY-MM-DD` | 일별 누적/상태 조회 | Planned | |
| `GET /api/focus-time/summary?range=week` | 주간/월간 요약 | Planned | |
| `POST /api/focus-time/sessions` | 집중 세션 시작 | Optional | 액션형 대체 |
| `PATCH /api/focus-time/sessions/:id` | 집중 세션 종료 | Optional | 액션형 대체 |
| `GET /api/github/activity?date=YYYY-MM-DD` | 일별 GitHub 활동 | Planned | |
| `GET /api/stats/daily?date=YYYY-MM-DD` | 일일 통계 조회 | Planned | 프로필 통계 |
| `GET /api/points?date=YYYY-MM-DD&aggregate=summary` | 일별 포인트 요약 | Planned | `/api/points/summary` 대체 |
| `GET /api/point-history` | 포인트 히스토리 | Implemented | 아래 참조 |
| `GET /api/rooms?status=active` | 활성 방 목록 | Optional | `/api/rooms/active` 대체 |
| `GET /api/rooms/:id/state` | 방 상태 프리로드 | Optional | |

---

## 인증 (Auth)

### GitHub 로그인 시작

```
GET /auth/github
```

GitHub OAuth 로그인 페이지로 리다이렉트

**Response:** 302 Redirect to GitHub

---

### GitHub OAuth 콜백

```
GET /auth/github/callback
```

GitHub에서 인증 완료 후 호출되는 콜백

**Response:**
- Set-Cookie: `access_token` (httpOnly, JWT)
- 302 Redirect to `/auth/callback`

---

### 현재 사용자 정보 조회

```
GET /auth/me
```

**Headers:**
```
Cookie: access_token=<JWT>
```

**Response:**
```json
{
  "githubId": "12345678",
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345678",
  "playerId": 101
}
```

**Error:**
- 401 Unauthorized: 토큰 없음 또는 만료

---

### 로그아웃

```
GET /auth/logout
```

**Response:**
- Clear-Cookie: `access_token`
- 302 Redirect to Frontend

---

## 태스크 (Tasks)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 태스크 생성

```
POST /api/tasks
```

**Body:**
```json
{
  "description": "오늘 할 일"
}
```

**Response:**
```json
{
  "id": 1,
  "description": "오늘 할 일",
  "totalFocusSeconds": 0,
  "isCompleted": false,
  "createdAt": "2025-01-18T00:00:00.000Z"
}
```

---

### 태스크 목록 조회

```
GET /api/tasks?startDate=YYYY-MM-DDTHH:mm:ss.sssZ&endDate=YYYY-MM-DDTHH:mm:ss.sssZ
```

`startDate`, `endDate`는 UTC ISO 8601 형식의 시간 범위입니다. 프론트엔드에서 로컬 타임존의 하루 범위를 UTC로 변환하여 전송합니다.

**Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "description": "오늘 할 일",
      "totalFocusSeconds": 0,
      "isCompleted": false,
      "createdAt": "2025-01-18T00:00:00.000Z"
    }
  ]
}
```

---

### 일별 완료 Task 개수 조회 (히트맵)

**Status:** Planned

```
GET /api/tasks/daily-counts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

`startDate`, `endDate`는 선택 파라미터이며, 미지정 시 1년 전 ~ 오늘 범위로 조회

**Response:**
```json
{
  "dailyTaskCounts": [
    {
      "date": "2024-01-15",
      "completedTaskCount": 5
    }
  ]
}
```

---

### 태스크 완료 처리

```
PATCH /api/tasks/completion/:taskId
```

**Response:**
```json
{
  "id": 1,
  "description": "오늘 할 일",
  "totalFocusSeconds": 25,
  "isCompleted": true,
  "createdAt": "2025-01-18T00:00:00.000Z"
}
```

---

### 태스크 완료 취소

```
PATCH /api/tasks/uncompletion/:taskId
```

**Response:**
```json
{
  "id": 1,
  "description": "오늘 할 일",
  "totalFocusSeconds": 25,
  "isCompleted": false,
  "createdAt": "2025-01-18T00:00:00.000Z"
}
```

---

### 태스크 수정

```
PATCH /api/tasks/:taskId
```

**Body:**
```json
{
  "description": "수정된 할 일"
}
```

**Response:**
```json
{
  "id": 1,
  "description": "수정된 할 일",
  "totalFocusSeconds": 25,
  "isCompleted": false,
  "createdAt": "2025-01-18T00:00:00.000Z"
}
```

---

### 태스크 삭제

```
DELETE /api/tasks/:taskId
```

**Response:** 200 OK

---

## 통계 (Stats)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 일일 통계 조회

**Status:** Planned

```
GET /api/stats/daily?date=YYYY-MM-DD
```

**Response:**
```json
{
  "date": "2024-01-16",
  "focusMinutes": 120,
  "completedTasks": 5,
  "committed": 3,
  "issuesOpened": 1,
  "prsCreated": 2,
  "prsReviewed": 4,
  "prsMerged": 1
}
```

---

## 플레이어 (Players)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 내 프로필 조회

```
GET /api/players/me
```

**Response:**
```json
{
  "playerId": 101,
  "githubId": "12345678",
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345678",
  "nickname": "octocat",
  "totalPoint": 1200,
  "primaryUserPetId": 5
}
```

---

### 내 프로필 수정 (닉네임/대표펫)

```
PATCH /api/players/me
```

**Body:**
```json
{
  "nickname": "new-nick",
  "primaryUserPetId": 5
}
```

**Response:**
```json
{
  "playerId": 101,
  "githubId": "12345678",
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345678",
  "nickname": "new-nick",
  "totalPoint": 1200,
  "primaryUserPetId": 5
}
```

---

### 공개 프로필 조회

```
GET /api/players/:id
```

**Response:**
```json
{
  "playerId": 101,
  "nickname": "octocat",
  "totalPoint": 1200,
  "primaryUserPetId": 5
}
```

---

## 펫 (Pets)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 펫 도감 조회

```
GET /api/pets
```

**Response:**
```json
{
  "pets": [
    {
      "id": 1,
      "name": "Sample Pet",
      "description": "Sample description",
      "evolutionStage": 1,
      "evolutionRequiredExp": 100,
      "actualImgUrl": "/assets/pets/1.png",
      "silhouetteImgUrl": "/assets/pets/1_shadow.png"
    }
  ]
}
```

---

### 보유 펫 조회

```
GET /api/pets/me
```

**Response:**
```json
{
  "pets": [
    {
      "userPetId": 10,
      "petId": 1,
      "exp": 50,
      "isPrimary": true
    }
  ]
}
```

---

### 펫 뽑기

```
POST /api/pet-draws
```

**Body:**
```json
{
  "count": 1
}
```

**Response:**
```json
{
  "draws": [
    {
      "userPetId": 10,
      "petId": 1,
      "petName": "Sample Pet",
      "isNew": true
    }
  ]
}
```

---

## 포커스 타임 (Focus Time)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 일별 포커스 조회

```
GET /api/focus-time?date=YYYY-MM-DD
```

**Response:**
```json
{
  "date": "2025-01-18",
  "status": "FOCUSING",
  "totalFocusSeconds": 120,
  "lastFocusStartTime": "2025-01-18T10:30:00.000Z"
}
```

---

### 포커스 요약 조회

```
GET /api/focus-time/summary?range=week
```

**Response:**
```json
{
  "range": "week",
  "totalFocusSeconds": 520,
  "days": [
    {
      "date": "2025-01-12",
      "totalFocusSeconds": 60
    }
  ]
}
```

---

### 집중 세션 시작

```
POST /api/focus-time/sessions
```

**Response:**
```json
{
  "sessionId": 10,
  "status": "FOCUSING",
  "totalFocusSeconds": 120,
  "lastFocusStartTime": "2025-01-18T10:30:00.000Z"
}
```

---

### 집중 세션 종료

```
PATCH /api/focus-time/sessions/:id
```

**Response:**
```json
{
  "sessionId": 10,
  "status": "RESTING",
  "totalFocusSeconds": 130
}
```

---

## GitHub 활동 (GitHub Activity)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 일별 GitHub 활동 조회

```
GET /api/github/activity?date=YYYY-MM-DD
```

**Response:**
```json
{
  "date": "2025-01-18",
  "activities": [
    {
      "type": "COMMITTED",
      "count": 3
    }
  ]
}
```

---

## 포인트 (Points)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 일별 포인트 요약

```
GET /api/points?date=YYYY-MM-DD&aggregate=summary
```

**Response:**
```json
{
  "date": "2025-01-18",
  "amount": 120
}
```

---

### 포인트 히스토리

```
GET /api/point-history?playerId=101&startDate=YYYY-MM-DDTHH:mm:ss.sssZ&endDate=YYYY-MM-DDTHH:mm:ss.sssZ
```

`playerId`는 필수 파라미터입니다. `startDate`, `endDate`는 UTC ISO 8601 형식의 시간 범위입니다.

**Response:**
```json
[
  {
    "id": 1,
    "type": "COMMITTED",
    "amount": 2,
    "description": "feat: 새 기능 추가",
    "createdAt": "2025-01-18T10:35:00.000Z"
  },
  {
    "id": 2,
    "type": "PR_OPEN",
    "amount": 2,
    "description": "로그인 기능 구현",
    "createdAt": "2025-01-18T11:00:00.000Z"
  }
]
```

**필드 설명:**
- `type`: 포인트 타입 (`COMMITTED`, `PR_OPEN`, `PR_MERGED`, `PR_REVIEWED`, `ISSUE_OPEN`, `TASK_COMPLETED`, `FOCUSED`)
- `amount`: 획득 포인트
- `description`: 활동 상세 (커밋 메시지, PR/이슈 제목 등)

---

## 방 (Rooms)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 활성 방 목록

```
GET /api/rooms?status=active
```

**Response:**
```json
{
  "rooms": [
    {
      "id": "room-1",
      "size": 5,
      "capacity": 14
    }
  ]
}
```

---

### 방 상태 프리로드

```
GET /api/rooms/:id/state
```

**Response:**
```json
{
  "roomId": "room-1",
  "progress": 0.3,
  "contributions": {
    "octocat": 5
  }
}
```

---

## 리더보드 (Leaderboard)

**Headers:**
```
Cookie: access_token=<JWT>
```

### 주간 리더보드 조회

**Status:** Planned

```
GET /api/leaderboard
```

현재 시즌의 주간 순위와 시즌 종료 시간을 조회

**Response:**
```json
{
  "seasonEndTime": "2025-02-02T00:00:00.000Z",
  "players": [
    {
      "rank": 1,
      "username": "ldh-dodo",
      "profileImage": "https://github.com/ldh-dodo.png",
      "points": 131
    },
    {
      "rank": 2,
      "username": "heisjun",
      "profileImage": "https://github.com/heisjun.png",
      "points": 98
    },
    {
      "rank": 3,
      "username": "songhaechan",
      "profileImage": "https://github.com/songhaechan.png",
      "points": 76
    },
    {
      "rank": 4,
      "username": "honki12345",
      "profileImage": "https://github.com/honki12345.png",
      "points": 54
    }
  ],
  "myRank": {
    "rank": 1,
    "username": "ldh-dodo",
    "profileImage": "https://github.com/ldh-dodo.png",
    "points": 131,
  }
}
```

**필드 설명:**
- `seasonEndTime`: 현재 시즌 종료 시간 (ISO 8601 형식)
- `players`: 순위별 플레이어 목록 (상위 N명)
  - `rank`: 순위
  - `username`: GitHub 유저네임
  - `profileImage`: GitHub 프로필 이미지 URL (`https://github.com/{username}.png`)
  - `points`: 해당 시즌 획득 포인트
- `myRank`: 요청한 사용자 본인의 순위 정보
  - `rank`: 순위
  - `username`: GitHub 유저네임
  - `profileImage`: GitHub 프로필 이미지 URL
  - `points`: 해당 시즌 획득 포인트

**비고:**
- 시즌 리셋 시간을 초 단위까지 넣어서 반환해줄 것인지 논의 필요
- 상위 N명만 반환(추후 논의)
- `myRank`는 상위 N명에 포함되지 않아도 항상 반환됨
- 프론트엔드에서 `seasonEndTime`을 기준으로 카운트다운 타이머 표시

---

## 맵 (Maps)

### 맵 이미지 조회

```
GET /api/maps/:index
```

맵 이미지를 서빙합니다. 권한 체크가 적용되어 **현재 맵만 접근 가능**합니다.

**Parameters:**
- `index`: 맵 인덱스 (0-4)

**Response:**
- 200: 맵 이미지 (webp)
- 403: 해금되지 않은 맵 (`Map not unlocked yet`)
- 404: 존재하지 않는 맵 인덱스

**예시:**
```
# 현재 맵이 0일 때
GET /api/maps/0  → 200 OK (이미지)
GET /api/maps/1  → 403 Forbidden
GET /api/maps/2  → 403 Forbidden
```

**특징:**
- 맵 이미지 스포일러 방지 (해금되지 않은 맵 접근 차단)
- 동적 로드: 게임 접속 시 `game_state`로 현재 맵 확인 후 로드
- 맵 전환 시 서버에서 mapIndex 업데이트 → 다음 맵 접근 가능

---

## 메트릭 (Monitoring)

### Prometheus 메트릭

```
GET /metrics
```

Prometheus 형식의 메트릭 데이터

**Response:**
```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 0.1234
...
```

---

## 정적 파일 서빙

### Frontend 정적 파일

```
GET /*
```

`/api/*`, `/auth/*`, `/socket.io/*`, `/metrics/*`를 제외한 모든 경로는 `backend/public` 폴더의 정적 파일 서빙

**예시:**
- `GET /` → `backend/public/index.html`
- `GET /login` → `backend/public/login.html`
- `GET /_next/static/...` → Next.js 정적 에셋
