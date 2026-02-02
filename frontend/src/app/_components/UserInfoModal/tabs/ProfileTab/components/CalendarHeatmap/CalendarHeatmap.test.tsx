import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { DailyPoints } from "./useHeatmapData";

describe("CalendarHeatmap", () => {
  const mockDailyPoints: DailyPoints = new Map([
    ["2026-01-01", 5],
    ["2026-01-02", 10],
    ["2026-01-15", 3],
  ]);

  const mockOnSelectDate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // scrollTo 모킹 (jsdom에서 지원하지 않음)
    Element.prototype.scrollTo = vi.fn();
  });

  it("HeatmapInfo가 렌더링된다", () => {
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    // HeatmapInfo는 포인트 획득 정책을 표시
    expect(screen.getByText("포인트 획득 정책")).toBeInTheDocument();
  });

  it("좌우 스크롤 버튼이 렌더링된다", () => {
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("요일 레이블이 표시된다", () => {
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
  });

  it("HeatmapLegend가 렌더링된다", () => {
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    expect(screen.getByText("less")).toBeInTheDocument();
    expect(screen.getByText("more")).toBeInTheDocument();
  });

  it("히트맵 셀들이 렌더링된다", () => {
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    // 히트맵 셀이 button role로 렌더링됨
    const cells = screen.getAllByRole("button").filter((btn) => {
      const label = btn.getAttribute("aria-label");
      return label && label.includes("points");
    });

    expect(cells.length).toBeGreaterThan(0);
  });

  it("셀 클릭 시 onSelectDate가 호출된다", async () => {
    const user = userEvent.setup();
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    const cells = screen.getAllByRole("button").filter((btn) => {
      const label = btn.getAttribute("aria-label");
      return label && label.includes("points");
    });

    if (cells.length > 0) {
      await user.click(cells[0]);
      expect(mockOnSelectDate).toHaveBeenCalledTimes(1);
      expect(mockOnSelectDate).toHaveBeenCalledWith(expect.any(Date));
    }
  });

  it("selectedDate가 제공되면 해당 날짜의 셀이 강조된다", () => {
    const selectedDate = new Date(2026, 0, 2);
    const { container } = render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
        selectedDate={selectedDate}
      />,
    );

    // 선택된 셀은 ring-2 클래스를 가짐
    const selectedCells = container.querySelectorAll(".ring-2.ring-amber-900");
    expect(selectedCells.length).toBeGreaterThan(0);
  });

  it("빈 dailyPoints로도 정상 렌더링된다", () => {
    render(
      <CalendarHeatmap
        dailyPoints={new Map()}
        onSelectDate={mockOnSelectDate}
      />,
    );

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("less")).toBeInTheDocument();
  });

  it("좌측 스크롤 버튼을 클릭할 수 있다", async () => {
    const user = userEvent.setup();
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const leftButton = buttons.find((btn) => {
      const svg = btn.querySelector("svg");
      return svg && svg.classList.contains("lucide-chevron-left");
    });

    expect(leftButton).toBeInTheDocument();
    if (leftButton) {
      await expect(user.click(leftButton)).resolves.not.toThrow();
    }
  });

  it("우측 스크롤 버튼을 클릭할 수 있다", async () => {
    const user = userEvent.setup();
    render(
      <CalendarHeatmap
        dailyPoints={mockDailyPoints}
        onSelectDate={mockOnSelectDate}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const rightButton = buttons.find((btn) => {
      const svg = btn.querySelector("svg");
      return svg && svg.classList.contains("lucide-chevron-right");
    });

    expect(rightButton).toBeInTheDocument();
    if (rightButton) {
      await expect(user.click(rightButton)).resolves.not.toThrow();
    }
  });
});
