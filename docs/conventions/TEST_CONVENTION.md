# 테스트 컨벤션

## 테스트 설명 스타일

테스트 설명은 **행위 중심 한글**로 작성합니다.

### 형식

```typescript
describe('기능/클래스명', () => {
  it('~하면 ~한다', async () => {
    // Given: 사전 조건
    // When: 테스트 대상 행위
    // Then: 검증
  });
});
```

### 예시

```typescript
describe('FocusTimeService', () => {
  describe('findOrCreate', () => {
    it('기존 레코드가 있으면 해당 레코드를 반환한다', async () => {
      // ...
    });

    it('기존 레코드가 없으면 새 레코드를 생성한다', async () => {
      // ...
    });
  });

  describe('startFocusing', () => {
    it('상태를 FOCUSING으로 변경한다', async () => {
      // ...
    });

    it('레코드가 없으면 NotFoundException을 던진다', async () => {
      // ...
    });
  });
});
```

---

## 테스트 구조

### Given-When-Then 패턴

```typescript
it('YYYY-MM-DD 문자열로 저장한 레코드를 같은 형식의 문자열로 조회할 수 있다', async () => {
  // Given: 플레이어와 FocusTime 레코드 생성
  const player = await createTestPlayer('TestPlayer');
  const today = new Date().toISOString().slice(0, 10);
  const focusTime = focusTimeRepository.create({
    player,
    totalFocusMinutes: 0,
    status: FocusStatus.RESTING,
    createdDate: today as unknown as Date,
  });
  await focusTimeRepository.save(focusTime);

  // When: 같은 YYYY-MM-DD 문자열로 조회
  const found = await focusTimeRepository.findOne({
    where: {
      player: { id: player.id },
      createdDate: today as unknown as Date,
    },
  });

  // Then: 레코드를 찾을 수 있어야 함
  expect(found).toBeDefined();
  expect(found.id).toBe(focusTime.id);
});
```

---

## 테스트 데이터베이스

### In-memory SQLite 사용

```typescript
beforeAll(async () => {
  module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [DailyFocusTime, Player],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([DailyFocusTime, Player]),
    ],
    providers: [FocusTimeService],
  }).compile();
});

afterAll(async () => {
  await module.close();
});
```

### 테스트 격리

각 테스트는 독립적으로 실행되어야 합니다.

```typescript
beforeEach(async () => {
  // 각 테스트 전 데이터 초기화
  await focusTimeRepository.clear();
  await playerRepository.clear();
});
```

---

## 테스트 파일 명명

- 단위 테스트: `*.spec.ts`
- E2E 테스트: `*.e2e-spec.ts`

예시:
- `focustime.service.spec.ts`
- `task.controller.spec.ts`
- `auth.e2e-spec.ts`
