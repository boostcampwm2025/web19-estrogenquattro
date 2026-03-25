import request from 'supertest';
import { Repository } from 'typeorm';

import { Player } from '../src/player/entites/player.entity';
import { Task } from '../src/task/entites/task.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
  seedAuthenticatedPlayer,
} from './e2e-test-helpers';

interface TaskBody {
  id: number;
  description: string;
  isCompleted?: boolean;
}

interface TaskListBody {
  tasks: TaskBody[];
}

interface ErrorBody {
  code: string;
}

describe('Task E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let taskRepository: Repository<Task>;

  const getHttpServer = (): Parameters<typeof request>[0] =>
    context.app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    context = await createTestApp({ includeTaskController: true });
    playerRepository = getRepository(context, Player);
    taskRepository = getRepository(context, Task);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await taskRepository.clear();
    await playerRepository.clear();
  });

  it('태스크 생성 시 description 300bytes는 허용되고 301bytes는 거부된다', async () => {
    // Given
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 23001,
      username: 'task-limit-user',
    });

    // When: 300bytes description 생성
    const created = await request(getHttpServer())
      .post('/api/tasks')
      .set('Cookie', seeded.cookie)
      .send({ description: 'a'.repeat(300) })
      .expect(201);
    const createdBody = created.body as TaskBody;

    // Then: 생성 성공
    expect(createdBody.description).toBe('a'.repeat(300));

    // When: 301bytes description 생성
    const tooLong = await request(getHttpServer())
      .post('/api/tasks')
      .set('Cookie', seeded.cookie)
      .send({ description: 'a'.repeat(301) })
      .expect(400);
    const tooLongBody = tooLong.body as ErrorBody;

    // Then: TASK_TOO_LONG 반환
    expect(tooLongBody.code).toBe('TASK_TOO_LONG');
  });

  it('태스크 수정 시 description 300bytes는 허용되고 301bytes는 거부된다', async () => {
    // Given
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 23002,
      username: 'task-update-user',
    });
    const created = await request(getHttpServer())
      .post('/api/tasks')
      .set('Cookie', seeded.cookie)
      .send({ description: '초기 Task' })
      .expect(201);
    const createdBody = created.body as TaskBody;
    const taskId = createdBody.id;

    // When: 300bytes description 수정
    const updated = await request(getHttpServer())
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', seeded.cookie)
      .send({ description: 'a'.repeat(300) })
      .expect(200);
    const updatedBody = updated.body as TaskBody;

    // Then: 수정 성공
    expect(updatedBody.description).toBe('a'.repeat(300));

    // When: 301bytes description 수정
    const tooLong = await request(getHttpServer())
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', seeded.cookie)
      .send({ description: 'a'.repeat(301) })
      .expect(400);
    const tooLongBody = tooLong.body as ErrorBody;

    // Then: TASK_TOO_LONG 반환
    expect(tooLongBody.code).toBe('TASK_TOO_LONG');
  });

  it('태스크 조회, 완료, 미완료, 삭제 흐름이 정상 동작한다', async () => {
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 23003,
      username: 'task-flow-user',
    });
    const now = new Date();
    const startAt = new Date(now);
    startAt.setHours(0, 0, 0, 0);
    const endAt = new Date(now);
    endAt.setHours(23, 59, 59, 999);
    const todayStart = startAt.toISOString();
    const todayEnd = endAt.toISOString();

    const created = await request(getHttpServer())
      .post('/api/tasks')
      .set('Cookie', seeded.cookie)
      .send({ description: 'Task Flow' })
      .expect(201);
    const createdBody = created.body as TaskBody;

    const todayTasks = await request(getHttpServer())
      .get(`/api/tasks/${seeded.player.id}`)
      .query({
        isToday: true,
        startAt: todayStart,
        endAt: todayEnd,
      })
      .set('Cookie', seeded.cookie)
      .expect(200);
    const todayTasksBody = todayTasks.body as TaskListBody;

    expect(todayTasksBody.tasks).toHaveLength(1);
    expect(todayTasksBody.tasks[0]).toMatchObject({
      id: createdBody.id,
      description: 'Task Flow',
      isCompleted: false,
    });

    const completed = await request(getHttpServer())
      .patch(`/api/tasks/completion/${createdBody.id}`)
      .set('Cookie', seeded.cookie)
      .expect(200);
    const completedBody = completed.body as TaskBody;
    expect(completedBody.isCompleted).toBe(true);

    const historyTasks = await request(getHttpServer())
      .get(`/api/tasks/${seeded.player.id}`)
      .query({
        isToday: false,
        startAt: todayStart,
        endAt: todayEnd,
      })
      .set('Cookie', seeded.cookie)
      .expect(200);
    const historyTasksBody = historyTasks.body as TaskListBody;
    expect(historyTasksBody.tasks).toHaveLength(1);
    expect(historyTasksBody.tasks[0].id).toBe(createdBody.id);

    const uncompleted = await request(getHttpServer())
      .patch(`/api/tasks/uncompletion/${createdBody.id}`)
      .set('Cookie', seeded.cookie)
      .expect(200);
    const uncompletedBody = uncompleted.body as TaskBody;
    expect(uncompletedBody.isCompleted).toBe(false);

    await request(getHttpServer())
      .delete(`/api/tasks/${createdBody.id}`)
      .set('Cookie', seeded.cookie)
      .expect(200);

    const remainingTasks = await taskRepository.find({
      where: { player: { id: seeded.player.id } },
    });
    expect(remainingTasks).toHaveLength(0);
  });
});
