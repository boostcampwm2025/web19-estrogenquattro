import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import StatsSection from "./StatsSection";
import { Task } from "@/app/_components/TasksMenu/types";
import { GithubEventsRes } from "@/lib/api";
import { DailyPoints } from "../CalendarHeatmap/useHeatmapData";
import { STAT_CARD_TYPES } from "../../constants/constants";

// GrassCard 모킹
vi.mock("./GrassCard", () => ({
  default: () => <div data-testid="grass-card">GrassCard</div>,
}));

describe("StatsSection", () => {
  const mockTasks: Task[] = [
    {
      id: 1,
      description: "Test Task 1",
      completed: true,
      time: 0,
      baseTime: 0,
      startTimestamp: null,
      isRunning: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      description: "Test Task 2",
      completed: false,
      time: 0,
      baseTime: 0,
      startTimestamp: null,
      isRunning: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockGithubEvents: GithubEventsRes = {
    startAt: "2026-02-02T00:00:00Z",
    endAt: "2026-02-02T23:59:59Z",
    committed: 5,
    issueOpened: 2,
    prCreated: 1,
    prReviewed: 3,
  };

  const mockDailyPoints: DailyPoints = new Map([
    ["2026-02-01", 10],
    ["2026-02-02", 5],
  ]);

  const mockOnCardSelect = vi.fn();

  const defaultProps = {
    tasks: mockTasks,
    selectedDate: new Date(2026, 1, 2),
    focusTimeSeconds: 3600,
    githubEvents: mockGithubEvents,
    dailyPoints: mockDailyPoints,
    playerId: 1,
    selectedCard: STAT_CARD_TYPES.TASK,
    onCardSelect: mockOnCardSelect,
  };

  it("GrassCard가 렌더링된다", () => {
    render(<StatsSection {...defaultProps} />);
    expect(screen.getByTestId("grass-card")).toBeInTheDocument();
  });

  it("6개의 StatCard가 렌더링된다", () => {
    const { container } = render(<StatsSection {...defaultProps} />);
    const statCards = container.querySelectorAll(".flex.flex-col.items-center");
    expect(statCards.length).toBe(6);
  });

  it("집중 시간이 포맷되어 표시된다", () => {
    render(<StatsSection {...defaultProps} />);
    expect(screen.getByText("집중 시간")).toBeInTheDocument();
    expect(screen.getByText("01:00:00")).toBeInTheDocument();
  });

  it("오늘 날짜일 때 전체 Task 개수가 표시된다", () => {
    const todayProps = {
      ...defaultProps,
      selectedDate: new Date(),
    };
    render(<StatsSection {...todayProps} />);
    const taskCard = screen.getByText("Task").closest("div");
    expect(taskCard).toBeInTheDocument();
    expect(taskCard).toHaveTextContent("2");
  });

  it("과거 날짜일 때 완료된 Task 개수만 표시된다", () => {
    const pastProps = {
      ...defaultProps,
      selectedDate: new Date(2025, 0, 1),
    };
    render(<StatsSection {...pastProps} />);
    const taskCard = screen.getByText("Task").closest("div");
    expect(taskCard).toBeInTheDocument();
    expect(taskCard).toHaveTextContent("1");
  });

  it("GitHub 이벤트 데이터가 표시된다", () => {
    render(<StatsSection {...defaultProps} />);

    const commitCard = screen.getByText("커밋").closest("div");
    expect(commitCard).toHaveTextContent("5");

    const issueCard = screen.getByText("이슈 생성").closest("div");
    expect(issueCard).toHaveTextContent("2");

    const prCreatedCard = screen.getByText("PR 생성").closest("div");
    expect(prCreatedCard).toHaveTextContent("1");

    const prReviewedCard = screen.getByText("PR 리뷰").closest("div");
    expect(prReviewedCard).toHaveTextContent("3");
  });

  it("클릭 가능한 카드 클릭 시 onCardSelect가 호출된다", async () => {
    const user = userEvent.setup();
    render(<StatsSection {...defaultProps} />);

    const taskCard = screen.getByText("Task").closest("div");
    if (taskCard) {
      await user.click(taskCard);
      expect(mockOnCardSelect).toHaveBeenCalledWith(STAT_CARD_TYPES.TASK);
    }
  });

  it("선택된 카드가 강조 표시된다", () => {
    render(<StatsSection {...defaultProps} />);

    const taskCard = screen.getByText("Task").closest("div");
    expect(taskCard).toHaveClass("border-amber-600", "bg-amber-100");
  });

  it("focusTimeSeconds가 없을 때 0으로 표시된다", () => {
    const propsWithoutFocusTime = {
      ...defaultProps,
      focusTimeSeconds: undefined,
    };
    render(<StatsSection {...propsWithoutFocusTime} />);
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });

  it("githubEvents가 없어도 정상 렌더링된다", () => {
    const propsWithoutGithub = {
      ...defaultProps,
      githubEvents: undefined,
    };
    render(<StatsSection {...propsWithoutGithub} />);
    expect(screen.getByText("집중 시간")).toBeInTheDocument();
  });

  it("GrassCard에 올바른 props가 전달된다", () => {
    const { rerender } = render(<StatsSection {...defaultProps} />);
    expect(screen.getByTestId("grass-card")).toBeInTheDocument();

    const newDate = new Date(2026, 1, 3);
    rerender(<StatsSection {...defaultProps} selectedDate={newDate} />);
    expect(screen.getByTestId("grass-card")).toBeInTheDocument();
  });

  it("다른 카드를 선택할 수 있다", async () => {
    const user = userEvent.setup();
    mockOnCardSelect.mockClear();

    render(<StatsSection {...defaultProps} />);

    const commitCard = screen.getByText("커밋").closest("div");
    if (commitCard) {
      await user.click(commitCard);
      expect(mockOnCardSelect).toHaveBeenCalledWith(STAT_CARD_TYPES.COMMITTED);
    }
  });

  it("집중 시간 카드는 클릭할 수 없다", () => {
    render(<StatsSection {...defaultProps} />);

    const focusTimeCard = screen.getByText("집중 시간").closest("div");
    expect(focusTimeCard).not.toHaveClass("cursor-pointer");
  });
});
