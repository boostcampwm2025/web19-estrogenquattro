import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeatmapLegend } from "./HeatmapLegend";

describe("HeatmapLegend", () => {
  it("less 텍스트가 표시된다", () => {
    render(<HeatmapLegend />);
    expect(screen.getByText("less")).toBeInTheDocument();
  });

  it("more 텍스트가 표시된다", () => {
    render(<HeatmapLegend />);
    expect(screen.getByText("more")).toBeInTheDocument();
  });

  it("4개의 레벨 박스가 렌더링된다", () => {
    const { container } = render(<HeatmapLegend />);
    const boxes = container.querySelectorAll(".h-3.w-3.rounded-sm");
    expect(boxes).toHaveLength(4);
  });

  it("각 레벨 박스가 올바른 배경색 클래스를 가진다", () => {
    const { container } = render(<HeatmapLegend />);
    const boxes = container.querySelectorAll(".h-3.w-3.rounded-sm");

    expect(boxes[0]).toHaveClass("bg-heatmap-empty");
    expect(boxes[1]).toHaveClass("bg-heatmap-level-1");
    expect(boxes[2]).toHaveClass("bg-heatmap-level-2");
    expect(boxes[3]).toHaveClass("bg-heatmap-level-3");
  });

  it("모든 레벨 박스가 ring 스타일을 가진다", () => {
    const { container } = render(<HeatmapLegend />);
    const boxes = container.querySelectorAll(".h-3.w-3.rounded-sm");

    boxes.forEach((box) => {
      expect(box).toHaveClass("ring-1", "ring-amber-300");
    });
  });
});
