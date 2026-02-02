# 펫 시스템

## 개요

플레이어가 펫을 수집하고, 성장시키며, 장착하는 시스템

---

## 핵심 개념

### 엔티티 관계

```
Player (플레이어)
  ├── equipped_pet_id → Pet (장착된 펫)
  ├── UserPet[] (보유 펫 목록, 경험치 관리)
  └── UserPetCodex[] (펫 도감, 수집 이력)

Pet (펫 마스터)
  ├── species: 종 (예: gopher, duke)
  ├── evolutionStage: 진화 단계 (1, 2, 3)
  └── evolutionRequiredExp: 다음 진화에 필요한 경험치
```

### 주요 흐름

1. **가챠(Gacha)**: 랜덤 펫 획득
2. **먹이주기(Feed)**: 경험치 획득
3. **진화(Evolve)**: 다음 단계로 성장
4. **장착(Equip)**: 게임에서 표시할 펫 선택

---

## REST API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/pets/all` | 전체 펫 목록 (마스터) |
| GET | `/api/pets/inventory/:playerId` | 보유 펫 목록 |
| GET | `/api/pets/codex/:playerId` | 펫 도감 (수집한 펫 ID 목록) |
| POST | `/api/pets/gacha` | 가챠 실행 |
| POST | `/api/pets/feed` | 먹이주기 |
| POST | `/api/pets/evolve` | 진화 |

---

## 시퀀스 다이어그램

### 1. 가챠 (Gacha)

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant S as 서버
    participant DB as 데이터베이스

    C->>S: POST /api/pets/gacha
    S->>DB: 플레이어 포인트 확인

    alt 포인트 부족
        S-->>C: 400 Not enough points
    end

    S->>DB: Stage 1 펫 목록 조회
    S->>S: 랜덤 펫 선택

    S->>DB: 도감(Codex) 확인

    alt 이미 수집한 펫 (중복)
        S->>DB: 포인트 환급 (가챠 비용의 일부)
        S-->>C: 200 { id: -1, pet: {...}, refunded: true, refundAmount: N }
        Note right of C: 중복 펫<br/>(저장 안 됨, 포인트 환급)
    else 새로운 펫
        S->>DB: UserPet 생성
        S->>DB: UserPetCodex 등록
        S-->>C: 200 { id: N, pet: {...}, refunded: false }
    end
```

> **중복 환급 로직:** 이미 수집한 펫이 다시 뽑힐 경우 가챠 비용의 일부를 포인트로 환급합니다.

### 2. 먹이주기 → 진화 (Feed → Evolve)

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant S as 서버
    participant DB as 데이터베이스

    Note over C,DB: 먹이주기
    C->>S: POST /api/pets/feed { userPetId }
    S->>DB: UserPet 조회 (+ pet, player)

    alt 만렙 펫
        S-->>C: 400 Pet is already at max level
    end

    S->>DB: 포인트 차감 (현재 0)
    S->>DB: 경험치 +10
    S-->>C: 200 { exp: N, pet: {...} }

    Note over C,DB: 경험치 충족 시 진화
    C->>S: POST /api/pets/evolve { userPetId }
    S->>DB: UserPet 조회

    alt 경험치 부족
        S-->>C: 400 Not enough experience
    end

    S->>DB: 다음 단계 펫 조회<br/>(같은 species, stage+1)
    S->>DB: UserPet.pet 업데이트
    S->>DB: UserPet.exp = 0
    S->>DB: 도감(Codex) 등록
    S-->>C: 200 { pet: { stage: N+1 } }
```

### 3. 펫 장착 (Equip) - 실시간

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant S as 서버
    participant DB as 데이터베이스
    participant O as 다른 플레이어

    C->>S: REST: equipPet(petId)
    S->>DB: 도감(Codex) 확인

    alt 미수집 펫
        S-->>C: 400 You do not own this pet
    end

    S->>DB: Player.equippedPetId 업데이트
    S-->>C: 200 OK

    Note over C,O: Socket 이벤트로 실시간 반영
    C->>S: socket: pet_equipping { petId }
    S->>DB: 검증 (equippedPetId 일치)
    S->>DB: Pet.actualImgUrl 조회
    S->>O: socket: pet_equipped { userId, petImage }

    Note right of O: RemotePlayer 펫 업데이트
```

---

## 상태 다이어그램

### 펫 진화 상태

```mermaid
stateDiagram-v2
    [*] --> Stage1: 가챠
    Stage1 --> Stage1: 먹이주기 (exp < required)
    Stage1 --> Stage2: 진화 (exp >= required)
    Stage2 --> Stage2: 먹이주기
    Stage2 --> Stage3: 진화
    Stage3 --> [*]: 만렙 (evolutionRequiredExp = 0)
```

### 펫 수집 상태 (도감)

```mermaid
stateDiagram-v2
    [*] --> 미수집
    미수집 --> 수집완료: 가챠 또는 진화
    수집완료 --> 수집완료: 중복 가챠 (포인트 환급)

    state 수집완료 {
        [*] --> 미장착
        미장착 --> 장착중: 장착
        장착중 --> 미장착: 다른 펫 장착
    }
```

---

## 비용 및 보상

| 액션 | 포인트 비용 | 획득 |
|------|------------|------|
| 가챠 | 0 | Stage 1 펫 (랜덤) |
| 가챠 (중복) | 0 | 포인트 환급 |
| 먹이주기 | 0 | 경험치 +10 |
| 진화 | 0 | 다음 단계 펫 |

> **Note:** 현재 모든 비용이 0으로 설정되어 있음. 중복 펫 뽑기 시 일부 포인트 환급.

---

## 데이터 예시

### Pet (마스터 데이터)

```json
[
  { "id": 1, "name": "Gopher", "species": "gopher", "evolutionStage": 1, "evolutionRequiredExp": 100 },
  { "id": 2, "name": "Gopher Pro", "species": "gopher", "evolutionStage": 2, "evolutionRequiredExp": 200 },
  { "id": 3, "name": "Gopher Master", "species": "gopher", "evolutionStage": 3, "evolutionRequiredExp": 0 }
]
```

### UserPet (보유 펫)

```json
{
  "id": 1,
  "playerId": 101,
  "petId": 2,
  "exp": 50,
  "pet": { "name": "Gopher Pro", "evolutionStage": 2 }
}
```

### UserPetCodex (도감)

```json
[
  { "playerId": 101, "petId": 1, "acquiredAt": "2026-01-15T10:00:00Z" },
  { "playerId": 101, "petId": 2, "acquiredAt": "2026-01-20T15:30:00Z" }
]
```
