# Pet System API Specification

This document outlines the API endpoints implemented for the Pet System.

## Base URL

`/api/pets`

## 1. 펫 보관함 조회 (Inventory)

사용자가 보유한 모든 펫의 목록을 조회합니다.

- **URL**: `/pets/inventory`
- **Method**: `GET`
- **Response**: `UserPet[]`
  ```json
  [
    {
      "id": 1,
      "exp": 0,
      "pet": {
        "id": 1,
        "species": "go",
        "name": "고퍼",
        "description": "...",
        "evolutionStage": 1,
        "evolutionRequiredExp": 30,
        "actualImgUrl": "/assets/pets/pet_go_1.png"
      }
    }
  ]
  ```

## 2. 뽑기 (Gacha)

100 포인트를 소모하여 랜덤한 1단계 펫을 획득합니다.
(획득한 펫은 `user_pets`에 추가되며, 최초 획득 시 `user_pet_codex`에도 등록됩니다.)

- **URL**: `/pets/gacha`
- **Method**: `POST`
- **Response**: `UserPet`

```json
  {
    "id": 2,
    "exp": 0,
    "pet": { "id": 4, "name": "도커", ... },
    "player": { "id": 1, "totalPoint": 900, ... }
  }
```

- **Error**:
  - `400 BadRequest`: 포인트 부족
  - `500 InternalServerError`: 뽑을 수 있는 펫 데이터 없음

## 3. 펫 먹이주기 (Feed)

10 포인트를 소모하여 특정 펫의 경험치를 10 증가시킵니다.

- **URL**: `/pets/feed`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "userPetId": 1
  }
  ```
- **Response**: `UserPet` (업데이트된 경험치 정보 포함)
- **Error**:
  - `400 BadRequest`: 포인트 부족, 내 펫이 아님, 이미 만렙임
  - `404 NotFound`: 펫을 찾을 수 없음

## 4. 펫 진화 (Evolve)

해당 펫이 진화 조건(경험치 충족)을 달성했을 때, 다음 단계의 펫으로 진화시킵니다.

- **URL**: `/pets/evolve`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "userPetId": 1
  }
  ```
- **Response**: `UserPet` (진화된 새 펫 정보, 경험치는 0으로 초기화됨)
- **Error**:
  - `400 BadRequest`: 경험치 부족, 이미 최종 진화체임
  - `500 InternalServerError`: 다음 진화 단계 데이터 없음

## 5. 대표 펫 장착 (Equip)

플레이어의 대표 캐릭터(스킨)로 사용할 펫을 선택합니다.
(반드시 도감(`user_pet_codex`)에 등록된, 즉 한 번이라도 획득했던 펫이어야 합니다.)

- **URL**: `/players/me/equipped-pet`
- **Method**: `PATCH`
- **Request Body**:
  ```json
  {
    "petId": 2
  }
  ```
- **Response**:
  ```json
  {
    "success": true
  }
  ```
- **Error**:
  - `400 BadRequest`: 보유하지 않은(도감에 없는) 펫임
  - `404 NotFound`: 존재하지 않는 펫 ID
