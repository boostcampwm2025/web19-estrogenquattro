# ERD (Entity Relationship Diagram)

## 개요

GitHub 활동 기반 게이미피케이션 서비스의 데이터베이스 스키마

---

## ERD 다이어그램

```mermaid
erDiagram
    players ||--o{ tasks : has
    players ||--o{ daily_focus_time : has
    players ||--o{ user_pets : owns
    players ||--o{ user_pet_codex : owns
    players ||--o{ daily_github_activity : has
    players ||--o{ daily_point : has
    pets ||--o{ user_pets : "is owned as"
    pets ||--o{ user_pet_codex : "is recorded in"
    players ||--o| pets : "equips"
    daily_focus_time }o--o| tasks : "focuses on"

    players {
        int id PK
        bigint social_id UK "GitHub 유니크 ID"
        varchar nickname "로그인 시 업데이트"
        int equipped_pet_id FK "장착된 펫 ID"
        int total_point "총 포인트"
    }

    tasks {
        bigint id PK
        bigint player_id FK
        varchar description "작업 설명 (100자)"
        int total_focus_seconds "누적 집중 시간 (초)"
        string completed_date "완료 날짜 (YYYY-MM-DD, nullable)"
        string created_date "생성 날짜 (YYYY-MM-DD)"
    }

    daily_focus_time {
        bigint id PK
        bigint player_id FK
        int total_focus_seconds "집중 시간 (초)"
        enum status "FOCUSING | RESTING"
        string created_date "집계 날짜 (YYYY-MM-DD)"
        datetime last_focus_start_time "마지막 집중 시작 시각"
        int current_task_id FK "현재 집중 중인 Task ID (nullable)"
    }

    pets {
        int id PK
        varchar name "펫 이름"
        varchar description "펫 설명"
        varchar species "펫 종"
        int evolution_stage "진화 단계"
        int evolution_required_exp "진화 필요 경험치"
        varchar actual_img_url "실제 이미지 URL"
    }

    user_pets {
        bigint id PK
        bigint player_id FK
        bigint pet_id FK
        int exp "펫 경험치"
    }

    daily_github_activity {
        bigint id PK
        enum type "활동 타입"
        bigint player_id FK
        int count "활동 횟수"
        string created_date "집계 날짜 (YYYY-MM-DD)"
    }

    daily_point {
        bigint id PK
        bigint player_id FK
        int amount "일별 포인트"
        string created_date "집계 날짜 (YYYY-MM-DD)"
    }

    point_history {
        bigint id PK
        bigint player_id FK
        enum type "포인트 타입"
        int amount "포인트 량"
        varchar description "활동 상세 (레포명, PR/이슈 제목)"
        datetime created_at "생성 시각"
    }

    user_pet_codex {
        int id PK
        int player_id FK
        int pet_id FK
        datetime acquired_at "획득 시각"
    }
```

---

## 테이블 상세

### players (플레이어)

플레이어 기본 정보

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | int | PK, AUTO_INCREMENT | 고유 ID |
| social_id | bigint | UNIQUE, NOT NULL | GitHub 유니크 ID |
| nickname | varchar(20) | NOT NULL | 닉네임 (로그인 시 업데이트) |
| equipped_pet_id | int | FK → pets.id, NULL 허용 | 장착된 펫 ID |
| total_point | int | DEFAULT 0 | 총 누적 포인트 |

---

### tasks (작업)

플레이어의 작업 기록

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, AUTO_INCREMENT | 고유 ID |
| player_id | bigint | FK → players.id | 플레이어 ID |
| description | varchar(100) | | 작업 설명 |
| total_focus_seconds | int | DEFAULT 0 | 누적 집중 시간 (초) |
| completed_date | string | NULL 허용 | 완료 날짜 (YYYY-MM-DD 형식) |
| created_date | string | NOT NULL | 생성 날짜 (YYYY-MM-DD 형식) |

> **Note:** `completed_date`, `created_date`는 TypeORM에서 `string` 타입으로 저장 (SQLite date 컬럼)

---

### daily_focus_time (일별 집중 시간)

일별 집중 시간 집계 테이블

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, AUTO_INCREMENT | 고유 ID |
| player_id | bigint | FK → players.id | 플레이어 ID |
| total_focus_seconds | int | DEFAULT 0 | 집중 시간 (초) |
| status | enum | NOT NULL | `FOCUSING` 또는 `RESTING` |
| created_date | string | NOT NULL | 집계 기준 날짜 (YYYY-MM-DD 형식) |
| last_focus_start_time | datetime | NULL 허용 | 마지막 집중 시작 시각 |
| current_task_id | int | FK → tasks.id, NULL 허용 | 현재 집중 중인 Task ID |

> **Note:** `created_date`는 TypeORM에서 `string` 타입으로 저장 (SQLite date 컬럼).
> `current_task_id`는 Task 테이블과 ManyToOne 관계로 연결됨.

---

### pets (펫 마스터)

펫 기본 정보 (시드 데이터)

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | int | PK, AUTO_INCREMENT | 고유 ID |
| name | varchar(20) | NOT NULL | 펫 이름 |
| description | varchar(100) | NOT NULL | 펫 설명 |
| species | varchar(20) | NOT NULL | 펫 종 |
| evolution_stage | int | NOT NULL | 진화 단계 (1, 2, 3...) |
| evolution_required_exp | int | NOT NULL | 다음 진화에 필요한 경험치 |
| actual_img_url | varchar(100) | NOT NULL | 실제 이미지 경로 |

---

### user_pets (유저 보유 펫)

플레이어가 보유한 펫

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, AUTO_INCREMENT | 고유 ID |
| player_id | bigint | FK → players.id | 플레이어 ID |
| pet_id | bigint | FK → pets.id | 펫 ID |
| exp | int | DEFAULT 0 | 현재 경험치 |

**인덱스:** `UNIQUE(player_id, pet_id)` - 플레이어별 펫 1개

---

### daily_github_activity (일별 GitHub 활동)

일별 GitHub 활동 집계 테이블

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, AUTO_INCREMENT | 고유 ID |
| type | enum | NOT NULL | 활동 타입 |
| player_id | bigint | FK → players.id | 플레이어 ID |
| count | int | DEFAULT 0 | 활동 횟수 |
| created_date | string | NOT NULL | 집계 기준 날짜 (YYYY-MM-DD 형식) |

> **Note:** `created_date`는 TypeORM에서 `string` 타입으로 저장 (SQLite date 컬럼)

**활동 타입 (type):**
- `ISSUE_OPEN` - 이슈 생성
- `PR_OPEN` - PR 생성
- `PR_MERGED` - PR 머지
- `PR_REVIEWED` - PR 리뷰
- `COMMITTED` - 커밋

**인덱스:** `UNIQUE(player_id, type, created_date)` - 플레이어별 타입별 일별 1개 레코드

---

### daily_point (일별 포인트)

일별 포인트 집계 테이블

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, AUTO_INCREMENT | 고유 ID |
| player_id | bigint | FK → players.id | 플레이어 ID |
| amount | int | DEFAULT 0 | 일별 누적 포인트 |
| created_date | string | NOT NULL | 집계 기준 날짜 (YYYY-MM-DD 형식) |

**인덱스:** `UNIQUE(player_id, created_date)` - 플레이어별 일별 1개 레코드

> **Note:** `created_date`는 TypeORM에서 `string` 타입으로 저장 (SQLite date 컬럼)

---

### point_history (포인트 내역)

포인트 획득/차감 상세 내역 및 GitHub 활동 상세 정보

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, AUTO_INCREMENT | 고유 ID |
| player_id | bigint | FK → players.id | 플레이어 ID |
| type | enum | NOT NULL | 포인트 타입 |
| amount | int | NOT NULL | 포인트 량 |
| description | varchar(200) | NULL 허용 | 활동 상세 (레포명, PR/이슈 제목) |
| created_at | datetime | NOT NULL | 생성 시각 |

**포인트 타입 (type):**
- `ISSUE_OPEN` - 이슈 생성
- `PR_OPEN` - PR 생성
- `PR_MERGED` - PR 머지
- `PR_REVIEWED` - PR 리뷰
- `COMMITTED` - 커밋
- `TASK_COMPLETED` - 작업 완료
- `FOCUSED` - 집중 시간

**description 컬럼 예시:**

| type | description 예시 |
|------|-----------------|
| COMMITTED | `"owner/repo"` (레포지토리 이름) |
| PR_OPEN | `"feat: 로그인 기능 구현"` (PR 제목) |
| PR_MERGED | `"fix: 버그 수정"` (PR 제목) |
| ISSUE_OPEN | `"버그: 로그인 실패"` (이슈 제목) |
| PR_REVIEWED | `"feat: 새 기능"` (리뷰한 PR 제목) |
| TASK_COMPLETED | `"오늘 할 일"` (Task 설명) |
| FOCUSED | `null` |

---

### user_pet_codex (펫 도감)

플레이어가 획득한 적 있는 펫 도감

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | int | PK, AUTO_INCREMENT | 고유 ID |
| player_id | int | FK → players.id | 플레이어 ID |
| pet_id | int | FK → pets.id | 펫 ID |
| acquired_at | datetime | NOT NULL | 획득 시각 |

**인덱스:** `UNIQUE(player_id, pet_id)` - 플레이어별 펫 1개 레코드

---

## 포인트 시스템

### 포인트 획득 기준 (예시)

| 활동 | 포인트 |
|------|--------|
| 커밋 (COMMITTED) | +2 |
| PR 생성 (PR_OPEN) | +5 |
| PR 머지 (PR_MERGED) | +10 |
| PR 리뷰 (PR_REVIEWED) | +3 |
| 이슈 생성 (ISSUE_OPEN) | +3 |
| 작업 완료 (TASK_COMPLETED) | +1 |
| 집중 시간 10분 (FOCUSED) | +1 |

---

## 펫 진화 시스템

```
[1단계 펫] ---(exp 도달)---> [2단계 펫] ---(exp 도달)---> [3단계 펫]
```

- 펫 경험치는 포인트 획득 시 함께 증가
- `evolution_required_exp` 도달 시 다음 단계로 진화 가능
- 진화 시 새로운 `user_pets` 레코드 생성 또는 `pet_id` 업데이트

---

## 설계 특징

### 일별 집계 테이블

- `daily_focus_time`, `daily_github_activity`, `daily_point`
- 조회 성격이 일별 조회가 강하기 때문에 별도 집계 테이블로 분리
- 쿼리 성능 최적화

### 시드 데이터

- `pets` 테이블은 시드 데이터로 미리 채워야 함
- 진화 단계별 펫 정보 포함
