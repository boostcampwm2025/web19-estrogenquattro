import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/app/_components/TasksMenu/types";
import { useAuthStore } from "./authStore";
import { FOCUS_STATUS, useFocusTimeStore } from "./useFocusTimeStore";
import { useTasksStore } from "./useTasksStore";

const apiMocks = vi.hoisted(() => ({
  completeTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasks: vi.fn(),
  uncompleteTask: vi.fn(),
  updateTask: vi.fn(),
}));

const socketMocks = vi.hoisted(() => ({
  socket: {
    connected: true,
    emit: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    code?: string;

    constructor(code?: string) {
      super(code);
      this.code = code;
    }
  },
  taskApi: apiMocks,
}));

vi.mock("@/lib/socket", () => ({
  getSocket: () => socketMocks.socket,
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    taskComplete: vi.fn(),
    taskCreate: vi.fn(),
    taskDelete: vi.fn(),
  },
}));

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    description: "task",
    completed: false,
    time: 10,
    baseTime: 10,
    startTimestamp: null,
    isRunning: false,
    createdAt: "2025-01-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("useTasksStore local actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-18T00:00:10.000Z"));
    vi.clearAllMocks();
    socketMocks.socket.connected = true;
    useTasksStore.setState({
      tasks: [],
      isLoading: false,
      error: null,
      pendingTaskIds: [],
    });
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
    useFocusTimeStore.setState({
      status: FOCUS_STATUS.RESTING,
      isFocusTimerRunning: false,
      error: null,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetchTasks는 인증 로딩 중이면 아무 작업도 하지 않고, 비로그인 상태면 에러를 남긴다", async () => {
    useAuthStore.setState({ isLoading: true });
    await useTasksStore.getState().fetchTasks();
    expect(apiMocks.getTasks).not.toHaveBeenCalled();

    useAuthStore.setState({
      isLoading: false,
      user: null,
      isAuthenticated: false,
    });
    await useTasksStore.getState().fetchTasks();

    expect(useTasksStore.getState().tasks).toEqual([]);
    expect(useTasksStore.getState().error).toBe("로그인이 필요합니다.");
  });

  it("getTaskDisplayTime, toggleTaskTimer, stopAllTasks는 타이머 시간을 누적한다", () => {
    useTasksStore.setState({
      tasks: [
        buildTask({
          id: 1,
          time: 30,
          baseTime: 30,
          isRunning: true,
          startTimestamp: Date.now() - 4000,
        }),
        buildTask({
          id: 2,
          description: "second",
          time: 5,
          baseTime: 5,
        }),
      ],
    });

    expect(
      useTasksStore
        .getState()
        .getTaskDisplayTime(useTasksStore.getState().tasks[0]),
    ).toBe(34);

    useTasksStore.getState().toggleTaskTimer(2);
    let [first, second] = useTasksStore.getState().tasks;
    expect(first.isRunning).toBe(false);
    expect(first.time).toBe(34);
    expect(second.isRunning).toBe(true);
    expect(second.startTimestamp).toBe(Date.now());

    vi.advanceTimersByTime(3000);
    useTasksStore.getState().stopAllTasks();
    [first, second] = useTasksStore.getState().tasks;
    expect(first.isRunning).toBe(false);
    expect(second.isRunning).toBe(false);
    expect(second.time).toBe(8);
  });

  it("removeCompletedTasks는 완료된 task만 제거한다", () => {
    useTasksStore.setState({
      tasks: [
        buildTask({ id: 1, completed: true }),
        buildTask({ id: 2, completed: false }),
      ],
    });

    useTasksStore.getState().removeCompletedTasks();
    expect(useTasksStore.getState().tasks.map((task) => task.id)).toEqual([2]);
  });

  it("집중 중인 task 삭제는 서버 요청 없이 차단한다", async () => {
    useTasksStore.setState({
      tasks: [buildTask({ id: 10, isRunning: true })],
    });

    await useTasksStore.getState().deleteTask(10);

    expect(apiMocks.deleteTask).not.toHaveBeenCalled();
    expect(useTasksStore.getState().error).toBe(
      "집중 중인 태스크는 삭제할 수 없습니다.",
    );
  });

  it("집중 중인 task 이름 수정은 focus_task_updating 이벤트를 전송한다", async () => {
    apiMocks.updateTask.mockResolvedValue({});
    useFocusTimeStore.setState({
      status: FOCUS_STATUS.FOCUSING,
      isFocusTimerRunning: true,
      error: null,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
    });
    useTasksStore.setState({
      tasks: [buildTask({ id: 11, isRunning: true, description: "before" })],
    });

    await useTasksStore.getState().editTask(11, "수정된 작업");

    expect(apiMocks.updateTask).toHaveBeenCalledWith(11, "수정된 작업");
    expect(socketMocks.socket.emit).toHaveBeenCalledWith(
      "focus_task_updating",
      {
        taskName: "수정된 작업",
      },
    );
    expect(useTasksStore.getState().tasks[0].description).toBe("수정된 작업");
  });
});
