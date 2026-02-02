import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("title과 value가 표시된다", () => {
    render(<StatCard title="Total Points" value={100} />);

    expect(screen.getByText("Total Points")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("value가 문자열일 때 올바르게 표시된다", () => {
    render(<StatCard title="Streak" value="10 days" />);

    expect(screen.getByText("Streak")).toBeInTheDocument();
    expect(screen.getByText("10 days")).toBeInTheDocument();
  });

  it("onClick이 없으면 클릭 불가능하다", () => {
    const { container } = render(<StatCard title="Test" value={0} />);
    const card = container.firstChild as HTMLElement;

    expect(card).not.toHaveClass("cursor-pointer");
  });

  it("onClick이 있으면 클릭 가능하다", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <StatCard title="Test" value={0} onClick={handleClick} />,
    );
    const card = container.firstChild as HTMLElement;

    expect(card).toHaveClass("cursor-pointer");
  });

  it("클릭 시 onClick 핸들러가 호출된다", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const { container } = render(
      <StatCard title="Test" value={0} onClick={handleClick} />,
    );

    await user.click(container.firstChild as HTMLElement);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("onClick이 없으면 클릭해도 에러가 발생하지 않는다", async () => {
    const user = userEvent.setup();
    const { container } = render(<StatCard title="Test" value={0} />);

    await expect(
      user.click(container.firstChild as HTMLElement),
    ).resolves.not.toThrow();
  });

  it("isSelected가 true일 때 선택된 스타일이 적용된다", () => {
    const { container } = render(
      <StatCard title="Test" value={0} isSelected={true} />,
    );
    const card = container.firstChild as HTMLElement;

    expect(card).toHaveClass("border-amber-600", "bg-amber-100");
  });

  it("isSelected가 false일 때 기본 스타일이 적용된다", () => {
    const { container } = render(
      <StatCard title="Test" value={0} isSelected={false} />,
    );
    const card = container.firstChild as HTMLElement;

    expect(card).toHaveClass("border-amber-800/20", "bg-amber-50");
  });

  it("isSelected가 없으면 기본값으로 false가 적용된다", () => {
    const { container } = render(<StatCard title="Test" value={0} />);
    const card = container.firstChild as HTMLElement;

    expect(card).toHaveClass("border-amber-800/20", "bg-amber-50");
  });

  it("클릭 가능한 카드는 hover 스타일을 가진다", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <StatCard title="Test" value={0} onClick={handleClick} />,
    );
    const card = container.firstChild as HTMLElement;

    expect(card).toHaveClass("hover:border-amber-600", "hover:bg-amber-100");
  });

  it("여러 상태가 동시에 적용된다", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <StatCard
        title="Active Card"
        value={42}
        onClick={handleClick}
        isSelected={true}
      />,
    );
    const card = container.firstChild as HTMLElement;

    expect(card).toHaveClass("cursor-pointer");
    expect(card).toHaveClass("border-amber-600", "bg-amber-100");
    expect(screen.getByText("Active Card")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
