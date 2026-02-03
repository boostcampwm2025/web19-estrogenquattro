import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeatmapCell } from "./HeatmapCell";
import { DayData } from "./useHeatmapData";

describe("HeatmapCell", () => {
  const mockDay: DayData = {
    date: new Date(2026, 0, 29),
    value: 10,
  };

  const mockHandlers = {
    onSelectDate: vi.fn(),
    onMouseEnter: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseLeave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("클릭 가능한 셀은 button role을 가진다", () => {
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("빈 칸(value: -1)은 button role이 없다", () => {
    const emptyDay: DayData = { date: new Date(0), value: -1 };
    render(<HeatmapCell day={emptyDay} {...mockHandlers} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("aria-label에 날짜와 포인트 정보가 포함된다", () => {
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    const cell = screen.getByRole("button");
    const label = cell.getAttribute("aria-label");

    expect(label).toContain("2026");
    expect(label).toContain("10 points");
  });

  it("클릭 시 onSelectDate를 호출한다", async () => {
    const user = userEvent.setup();
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    await user.click(screen.getByRole("button"));

    expect(mockHandlers.onSelectDate).toHaveBeenCalledWith(mockDay.date);
    expect(mockHandlers.onSelectDate).toHaveBeenCalledTimes(1);
  });

  it("Enter 키 입력 시 onSelectDate를 호출한다", async () => {
    const user = userEvent.setup();
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    const cell = screen.getByRole("button");
    cell.focus();
    await user.keyboard("{Enter}");

    expect(mockHandlers.onSelectDate).toHaveBeenCalledWith(mockDay.date);
  });

  it("Space 키 입력 시 onSelectDate를 호출한다", async () => {
    const user = userEvent.setup();
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    const cell = screen.getByRole("button");
    cell.focus();
    await user.keyboard(" ");

    expect(mockHandlers.onSelectDate).toHaveBeenCalledWith(mockDay.date);
  });

  it("빈 칸 클릭 시 onSelectDate가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const emptyDay: DayData = { date: new Date(0), value: -1 };
    const { container } = render(
      <HeatmapCell day={emptyDay} {...mockHandlers} />,
    );

    await user.click(container.firstChild as HTMLElement);

    expect(mockHandlers.onSelectDate).not.toHaveBeenCalled();
  });

  it("마우스 호버 시 onMouseEnter를 호출한다", async () => {
    const user = userEvent.setup();
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    await user.hover(screen.getByRole("button"));

    expect(mockHandlers.onMouseEnter).toHaveBeenCalled();
    expect(mockHandlers.onMouseEnter).toHaveBeenCalledWith(
      expect.any(Object),
      mockDay,
    );
  });

  it("마우스 언호버 시 onMouseLeave를 호출한다", async () => {
    const user = userEvent.setup();
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    const cell = screen.getByRole("button");
    await user.hover(cell);
    await user.unhover(cell);

    expect(mockHandlers.onMouseLeave).toHaveBeenCalled();
  });

  it("키보드 포커스가 가능하다", () => {
    render(<HeatmapCell day={mockDay} {...mockHandlers} />);

    const cell = screen.getByRole("button");
    expect(cell).toHaveAttribute("tabIndex", "0");
  });

  it("빈 칸은 키보드 포커스가 불가능하다", () => {
    const emptyDay: DayData = { date: new Date(0), value: -1 };
    const { container } = render(
      <HeatmapCell day={emptyDay} {...mockHandlers} />,
    );

    expect(container.firstChild).not.toHaveAttribute("tabIndex");
  });
});
