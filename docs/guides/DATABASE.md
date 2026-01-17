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

**backend/src/task/task.entity.ts**:

```typescript
@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ default: false })
  completed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
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
└── 1768270149211-Auto.ts
```

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
