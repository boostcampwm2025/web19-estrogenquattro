import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskItem } from "./TaskItem";
import { Task } from "./types";

const mockTask: Task = {
  id: 1,
  description: "테스트 작업",
  completed: false,
  time: 0,
  baseTime: 0,
  startTimestamp: null,
  isRunning: false,
  createdAt: "2024-01-15T10:00:00Z",
};

describe("TaskItem", () => {
  it("작업 설명과 시간이 표시된다", () => {
    render(
      <TaskItem
        task={mockTask}
        displayTime={120}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    expect(screen.getByText("테스트 작업")).toBeInTheDocument();
    expect(screen.getByText("120초")).toBeInTheDocument();
  });

  it("완료된 작업은 줄이 그어진다", () => {
    const completedTask = { ...mockTask, completed: true };

    render(
      <TaskItem
        task={completedTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const description = screen.getByText("테스트 작업");
    expect(description).toHaveClass("line-through");
  });

  it("체크박스 클릭 시 onToggle이 호출된다", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={false}
        onToggle={onToggle}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("삭제 버튼 클릭 시 onDelete가 호출된다", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={onDelete}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const deleteButton = screen.getByLabelText("작업 삭제");
    await user.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("재생 버튼 클릭 시 onToggleTimer가 호출된다", async () => {
    const user = userEvent.setup();
    const onToggleTimer = vi.fn();

    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={onToggleTimer}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const timerButton = screen.getByLabelText("타이머 시작");
    await user.click(timerButton);

    expect(onToggleTimer).toHaveBeenCalledWith(1);
  });

  it("실행 중인 작업은 일시정지 버튼이 표시된다", () => {
    const runningTask = { ...mockTask, isRunning: true };

    render(
      <TaskItem
        task={runningTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    expect(screen.getByLabelText("타이머 일시정지")).toBeInTheDocument();
  });

  it("편집 버튼 클릭 시 편집 모드로 전환된다", async () => {
    const user = userEvent.setup();

    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const editButton = screen.getByLabelText("작업 편집");
    await user.click(editButton);

    const input = screen.getByDisplayValue("테스트 작업");
    expect(input).toBeInTheDocument();
  });

  it("편집 모드에서 수정 후 저장하면 onEdit이 호출된다", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={onEdit}
        formatTime={(s) => `${s}초`}
      />,
    );

    await user.click(screen.getByLabelText("작업 편집"));

    const input = screen.getByDisplayValue("테스트 작업");
    await user.clear(input);
    await user.type(input, "수정된 작업");

    const saveButton = screen.getByLabelText("작업 수정 저장");
    await user.click(saveButton);

    expect(onEdit).toHaveBeenCalledWith(1, "수정된 작업");
  });

  it("편집 모드에서 취소하면 원래 텍스트로 돌아간다", async () => {
    const user = userEvent.setup();

    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    await user.click(screen.getByLabelText("작업 편집"));

    const input = screen.getByDisplayValue("테스트 작업");
    await user.clear(input);
    await user.type(input, "변경된 작업");

    const cancelButton = screen.getByLabelText("작업 수정 취소");
    await user.click(cancelButton);

    expect(screen.getByText("테스트 작업")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("변경된 작업")).not.toBeInTheDocument();
  });

  it("isPending이 true면 로딩 아이콘이 표시된다", () => {
    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={true}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const loader = document.querySelector(".animate-spin");
    expect(loader).toBeInTheDocument();
  });

  it("isPending이 true면 모든 버튼이 비활성화된다", () => {
    render(
      <TaskItem
        task={mockTask}
        displayTime={0}
        isPending={true}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onToggleTimer={vi.fn()}
        onEdit={vi.fn()}
        formatTime={(s) => `${s}초`}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    const timerButton = screen.getByLabelText("타이머 시작");
    const editButton = screen.getByLabelText("작업 편집");
    const deleteButton = screen.getByLabelText("작업 삭제");

    expect(checkbox).toBeDisabled();
    expect(timerButton).toBeDisabled();
    expect(editButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });
});
