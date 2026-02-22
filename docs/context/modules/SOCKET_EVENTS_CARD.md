# SOCKET_EVENTS_CARD

## When To Load

- Gateway 이벤트 이름/방향/페이로드 질문
- 클라이언트 emit/on 흐름 추적 질문

## Primary Sources (Order)

1. `backend/src/**/*.gateway.ts`
2. `frontend/src/game/managers/SocketManager.ts`
3. `docs/api/SOCKET_EVENTS.md`

## Event Families

- Room/Player: `joining`, `joined`, `join_failed`, `players_synced`, `player_joined`, `player_left`
- Movement: `moving`, `moved`
- Chat: `chatting`, `chatted`
- Focus: `focusing`, `focused`, `resting`, `rested`, `focus_task_updating`, `focus_task_updated`
- Pet: `pet_equipping`, `pet_equipped`
- Music: `music_status`, `player_music_status`
- Session/Auth: `session_replaced`, `auth_expired`
- Progress: `progress_update`, `map_switch`, `season_reset`, `game_state`

## Retrieval Guidance

- 이벤트 정의 충돌 시 gateway 코드 기준으로 판단
- 문서는 빠른 탐색용, 구현은 최종 근거

## Sources

- `docs/api/SOCKET_EVENTS.md`
- `docs/README.md`
