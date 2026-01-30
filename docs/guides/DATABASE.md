# 데이터베이스 가이드

## 개요

- **ORM:** TypeORM
- **DB:** SQLite
- **파일 위치:** `backend/data/jandi.sqlite`

---

## TypeORM 설정

**backend/src/database/data-source.ts**:

```typescript
const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'data/jandi.sqlite',
  synchronize: false,       // 마이그레이션 사용
  logging: false,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
```

---

## 엔티티

### Task 엔티티

**backend/src/task/entites/task.entity.ts**:

```typescript
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ type: 'varchar', length: 100, nullable: false })
  description: string;

  @Column({ type: 'int', name: 'total_focus_seconds', default: 0 })
  totalFocusSeconds: number;

  @Column({ type: 'date', name: 'completed_date', nullable: true })
  completedDate: string | null;  // YYYY-MM-DD (UTC)

  @Column({ type: 'date', name: 'created_date' })
  createdDate: string;  // YYYY-MM-DD (UTC)
}
```

### DailyFocusTime 엔티티

**backend/src/focustime/entites/daily-focus-time.entity.ts**:

```typescript
@Entity('daily_focus_time')
export class DailyFocusTime {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'total_focus_seconds', type: 'int', default: 0 })
  totalFocusSeconds: number;

  @Column({
    type: 'simple-enum',
    enum: FocusStatus,
    default: FocusStatus.RESTING,
  })
  status: FocusStatus;

  @Column({ name: 'created_date', type: 'date', nullable: false })
  createdDate: string;

  @Column({ name: 'last_focus_start_time', type: 'datetime', nullable: true })
  lastFocusStartTime: Date;
}
```

---

## 마이그레이션

### 마이그레이션 명령어

```bash
cd backend

# 엔티티 변경 → 마이그레이션 자동 생성
pnpm migration:generate

# 마이그레이션 실행
pnpm migration:run

# 마이그레이션 롤백 (마지막 1개)
pnpm migration:revert
```

### 마이그레이션 파일 위치

```
backend/src/database/migrations/
```

> **Note:** 마이그레이션 파일은 `.gitignore`에 포함되어 있습니다.
> 각 개발자가 로컬에서 `pnpm migration:generate`로 직접 생성해야 합니다.
> 프로덕션 환경에서는 `synchronize: true` 또는 수동 스키마 관리를 권장합니다.

### 마이그레이션 예시

```typescript
export class Auto1768270149211 implements MigrationInterface {
  name = 'Auto1768270149211';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" varchar NOT NULL,
        "completed" boolean NOT NULL DEFAULT (0),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "task"`);
  }
}
```

---

## 새 엔티티 추가 방법

### 1. 엔티티 파일 생성

```typescript
// backend/src/example/example.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Example {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
```

### 2. 모듈에 등록

```typescript
// backend/src/example/example.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Example } from './example.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Example])],
})
export class ExampleModule {}
```

### 3. 마이그레이션 생성 및 실행

```bash
cd backend
pnpm migration:generate  # 마이그레이션 파일 자동 생성
pnpm migration:run       # 실행
```

---

## SQLite 특징

### 장점

- 설치/설정 불필요 (파일 기반)
- 경량, 빠른 시작
- 개발 환경에 적합

### 주의사항

- 동시 쓰기 제한 (단일 writer)
- 대규모 트래픽에 부적합
- 스케일아웃 불가

### 날짜 타입 규칙

SQLite는 별도의 `DATE` 타입이 없고 `TEXT`로 저장됩니다.

| 컬럼 타입 | TS 타입 | 형식 | 용도 |
|----------|---------|------|------|
| `date` | `string` | `YYYY-MM-DD` (UTC) | 날짜만 필요한 경우 |
| `datetime` | `Date` | ISO 8601 | 시간 연산이 필요한 경우 |

**예시:**

```typescript
// date 컬럼 - UTC 문자열로 저장
createdDate: new Date().toISOString().slice(0, 10)  // "2026-01-22"

// datetime 컬럼 - Date 객체 사용
lastFocusStartTime: new Date()
```

### 데이터 백업

```bash
# 파일 복사로 백업
cp backend/data/jandi.sqlite backend/data/jandi.sqlite.backup
```

---

## 디버깅

### SQL 로깅 활성화

```typescript
// data-source.ts
const AppDataSource = new DataSource({
  // ...
  logging: true,  // 또는 ['query', 'error']
});
```

### SQLite CLI 접속

```bash
sqlite3 backend/data/jandi.sqlite

# 테이블 목록
.tables

# 스키마 확인
.schema task

# 쿼리 실행
SELECT * FROM task;
```
