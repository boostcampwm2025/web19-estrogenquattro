import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksMenuContent from "./TasksMenuContent";
import * as useTasksStore from "@/stores/useTasksStore";
import * as useFocusTimeStore from "@/stores/useFocusTimeStore";

HTMLDivElement.prototype.scrollTo = vi.fn();

vi.mock("@/stores/useTasksStore");
vi.mock("@/stores/useFocusTimeStore");

describe("TasksMenuContent", () => {
  const mockTasksStore = {
    tasks: [],
    isLoading: false,
    error: null,
    pendingTaskIds: [],
    fetchTasks: vi.fn(),
    addTask: vi.fn(),
    toggleTask: vi.fn(),
    deleteTask: vi.fn(),
    editTask: vi.fn(),
    toggleTaskTimer: vi.fn(),
    stopAllTasks: vi.fn(),
    getTaskDisplayTime: vi.fn(() => 0),
    clearTaskError: vi.fn(),
  };

  const mockFocusStore = {
    getFocusTime: vi.fn(() => 0),
    baseFocusSeconds: 0,
    isFocusTimerRunning: false,
    startFocusing: vi.fn(),
    stopFocusing: vi.fn(),
    focusError: null,
    clearFocusError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTasksStore.useTasksStore).mockImplementation((selector: any) =>
      selector(mockTasksStore),
    );
    vi.mocked(useFocusTimeStore.useFocusTimeStore).mockImplementation(
      (selector: any) => selector(mockFocusStore),
    );
  });

  it("펼침 모드에서 타이머와 작업 목록이 렌더링된다", () => {
    render(
      <TasksMenuContent
        isExpanded={true}
        lastRunTaskId={null}
        setLastRunTaskId={vi.fn()}
      />,
    );

    expect(screen.getByText("[ Focus Time ]")).toBeInTheDocument();
    expect(screen.getByText("[ Tasks ]")).toBeInTheDocument();
  });

  it("접힌 모드에서 미니 컨트롤이 렌더링된다", () => {
    render(
      <TasksMenuContent
        isExpanded={false}
        lastRunTaskId={null}
        setLastRunTaskId={vi.fn()}
      />,
    );

    expect(screen.getByText("Task를 선택해주세요")).toBeInTheDocument();
  });

  it("마운트 시 fetchTasks가 호출된다", () => {
    render(
      <TasksMenuContent
        isExpanded={true}
        lastRunTaskId={null}
        setLastRunTaskId={vi.fn()}
      />,
    );

    expect(mockTasksStore.fetchTasks).toHaveBeenCalled();
  });

  it("타이머 시작 버튼 클릭 시 startFocusing이 호출된다", async () => {
    const user = userEvent.setup();

    render(
      <TasksMenuContent
        isExpanded={true}
        lastRunTaskId={null}
        setLastRunTaskId={vi.fn()}
      />,
    );

    const startButton = screen.getByText("시작");
    await user.click(startButton);

    expect(mockFocusStore.startFocusing).toHaveBeenCalled();
  });

  it("타이머 실행 중일 때 정지 버튼이 표시된다", () => {
    vi.mocked(useFocusTimeStore.useFocusTimeStore).mockImplementation(
      (selector: any) =>
        selector({ ...mockFocusStore, isFocusTimerRunning: true }),
    );

    render(
      <TasksMenuContent
        isExpanded={true}
        lastRunTaskId={null}
        setLastRunTaskId={vi.fn()}
      />,
    );

    expect(screen.getByText("정지")).toBeInTheDocument();
  });

  it("에러가 있으면 표시된다", () => {
    vi.mocked(useTasksStore.useTasksStore).mockImplementation((selector: any) =>
      selector({ ...mockTasksStore, error: "작업 로딩 실패" }),
    );

    render(
      <TasksMenuContent
        isExpanded={true}
        lastRunTaskId={null}
        setLastRunTaskId={vi.fn()}
      />,
    );

    expect(screen.getByText("작업 로딩 실패")).toBeInTheDocument();
  });
});
