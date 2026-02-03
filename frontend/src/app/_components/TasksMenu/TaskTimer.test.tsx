import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskTimer } from "./TaskTimer";

describe("TaskTimer", () => {
  it("시간과 버튼이 렌더링된다", () => {
    render(
      <TaskTimer
        time="00:05:30"
        isRunning={false}
        onToggle={vi.fn()}
        error={null}
      />,
    );

    expect(screen.getByText("00:05:30")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("타이머가 실행 중이면 정지 버튼이 표시된다", () => {
    render(
      <TaskTimer
        time="00:10:00"
        isRunning={true}
        onToggle={vi.fn()}
        error={null}
      />,
    );

    expect(screen.getByText("정지")).toBeInTheDocument();
  });

  it("타이머가 멈춰있으면 시작 버튼이 표시된다", () => {
    render(
      <TaskTimer
        time="00:00:00"
        isRunning={false}
        onToggle={vi.fn()}
        error={null}
      />,
    );

    expect(screen.getByText("시작")).toBeInTheDocument();
  });

  it("버튼 클릭 시 onToggle이 호출된다", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <TaskTimer
        time="00:00:00"
        isRunning={false}
        onToggle={onToggle}
        error={null}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("에러 메시지가 있으면 표시된다", () => {
    render(
      <TaskTimer
        time="00:00:00"
        isRunning={false}
        onToggle={vi.fn()}
        error="타이머 오류 발생"
      />,
    );

    expect(screen.getByText("타이머 오류 발생")).toBeInTheDocument();
  });

  it("에러가 없으면 에러 메시지가 표시되지 않는다", () => {
    render(
      <TaskTimer
        time="00:00:00"
        isRunning={false}
        onToggle={vi.fn()}
        error={null}
      />,
    );

    const alerts = screen.queryAllByRole("alert");
    expect(alerts).toHaveLength(0);
  });
});
