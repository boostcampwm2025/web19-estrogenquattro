import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTasksStore } from "@/stores/useTasksStore";
import { buildTaskEntity } from "../factories/task";
import {
  resetTaskStore,
  seedTaskStore,
} from "../mocks/handlers/tasks";
import { server } from "../mocks/server";
import { http, HttpResponse } from "msw";

describe("Tasks API 통합", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-18T00:00:00.000Z"));
    resetTaskStore();
    useTasksStore.setState({
      tasks: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Task 목록을 조회하면 오늘 날짜 Task만 스토어에 반영된다", async () => {
    seedTaskStore([
      buildTaskEntity({ id: 1, description: "오늘 작업" }),
      buildTaskEntity({
        id: 2,
        description: "어제 작업",
        createdDate: new Date("2025-01-17T00:00:00.000Z"),
      }),
    ]);

    await useTasksStore.getState().fetchTasks();

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].description).toBe("오늘 작업");
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("date 파라미터로 조회하면 해당 날짜 Task만 반영된다", async () => {
    seedTaskStore([
      buildTaskEntity({ id: 1, description: "오늘 작업" }),
      buildTaskEntity({
        id: 2,
        description: "어제 작업",
        createdDate: new Date("2025-01-17T00:00:00.000Z"),
      }),
    ]);

    await useTasksStore.getState().fetchTasks("2025-01-17");

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].description).toBe("어제 작업");
  });

  it("Task를 추가하면 새 항목이 생성된다", async () => {
    await useTasksStore.getState().addTask("새 작업");

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].description).toBe("새 작업");
  });

  it("Task 생성에 실패하면 에러 메시지가 설정된다", async () => {
    server.use(
      http.post("*/api/tasks", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    await useTasksStore.getState().addTask("실패 작업");

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(0);
    expect(state.error).toBe("Task 생성에 실패했습니다.");
  });

  it("Task 완료 처리 시 completed가 true로 변경된다", async () => {
    seedTaskStore([buildTaskEntity({ id: 10, description: "완료 테스트" })]);
    await useTasksStore.getState().fetchTasks();

    await useTasksStore.getState().toggleTask(10);

    const state = useTasksStore.getState();
    expect(state.tasks[0].completed).toBe(true);
  });

  it("Task 완료 취소 시 completed가 false로 변경된다", async () => {
    seedTaskStore([
      buildTaskEntity({
        id: 11,
        description: "완료 취소 테스트",
        completedDate: new Date("2025-01-18T00:00:00.000Z"),
      }),
    ]);
    await useTasksStore.getState().fetchTasks();

    await useTasksStore.getState().toggleTask(11);

    const state = useTasksStore.getState();
    expect(state.tasks[0].completed).toBe(false);
  });

  it("완료 처리 실패 시 상태를 롤백한다", async () => {
    seedTaskStore([buildTaskEntity({ id: 10, description: "실패 테스트" })]);
    await useTasksStore.getState().fetchTasks();

    server.use(
      http.patch("*/api/tasks/completion/:taskId", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    await useTasksStore.getState().toggleTask(10);

    const state = useTasksStore.getState();
    expect(state.tasks[0].completed).toBe(false);
    expect(state.error).toBe("Task 상태 변경에 실패했습니다.");
  });

  it("완료 취소 실패 시 상태를 롤백한다", async () => {
    seedTaskStore([
      buildTaskEntity({
        id: 12,
        description: "완료 취소 실패",
        completedDate: new Date("2025-01-18T00:00:00.000Z"),
      }),
    ]);
    await useTasksStore.getState().fetchTasks();

    server.use(
      http.patch("*/api/tasks/uncompletion/:taskId", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    await useTasksStore.getState().toggleTask(12);

    const state = useTasksStore.getState();
    expect(state.tasks[0].completed).toBe(true);
    expect(state.error).toBe("Task 상태 변경에 실패했습니다.");
  });

  it("Task 삭제에 성공하면 목록에서 제거된다", async () => {
    seedTaskStore([
      buildTaskEntity({ id: 21, description: "삭제 대상" }),
      buildTaskEntity({ id: 22, description: "남는 작업" }),
    ]);
    await useTasksStore.getState().fetchTasks();

    await useTasksStore.getState().deleteTask(21);

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe(22);
  });

  it("Task 삭제에 실패하면 삭제가 롤백된다", async () => {
    seedTaskStore([buildTaskEntity({ id: 31, description: "삭제 실패" })]);
    await useTasksStore.getState().fetchTasks();

    server.use(
      http.delete("*/api/tasks/:taskId", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    await useTasksStore.getState().deleteTask(31);

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe(31);
    expect(state.error).toBe("Task 삭제에 실패했습니다.");
  });

  it("Task 수정에 성공하면 text가 변경된다", async () => {
    seedTaskStore([buildTaskEntity({ id: 41, description: "수정 전" })]);
    await useTasksStore.getState().fetchTasks();

    await useTasksStore.getState().editTask(41, "수정 후");

    const state = useTasksStore.getState();
    expect(state.tasks[0].description).toBe("수정 후");
  });

  it("Task 수정에 실패하면 text가 롤백된다", async () => {
    seedTaskStore([buildTaskEntity({ id: 51, description: "롤백 전" })]);
    await useTasksStore.getState().fetchTasks();

    server.use(
      http.patch("*/api/tasks/:taskId", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    await useTasksStore.getState().editTask(51, "롤백 후");

    const state = useTasksStore.getState();
    expect(state.tasks[0].description).toBe("롤백 전");
    expect(state.error).toBe("Task 수정에 실패했습니다.");
  });

  it("Task 목록 조회에 실패하면 에러 상태가 설정된다", async () => {
    server.use(
      http.get("*/api/tasks", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    await useTasksStore.getState().fetchTasks();

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Task 목록을 불러오는데 실패했습니다.");
  });
});
