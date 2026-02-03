import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskList } from "./TaskList";
import { Task } from "./types";

HTMLDivElement.prototype.scrollTo = vi.fn();

const mockTasks: Task[] = [
  {
    id: 1,
    description: "작업 1",
    completed: false,
    time: 100,
    baseTime: 100,
    startTimestamp: null,
    isRunning: false,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    description: "작업 2",
    completed: true,
    time: 200,
    baseTime: 200,
    startTimestamp: null,
    isRunning: false,
    createdAt: "2024-01-15T11:00:00Z",
  },
];

describe("TaskList", () => {
  it("작업 목록이 렌더링된다", () => {
    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error={null}
        pendingTaskIds={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    expect(screen.getByText("작업 1")).toBeInTheDocument();
    expect(screen.getByText("작업 2")).toBeInTheDocument();
  });

  it("완료 카운트가 표시된다", () => {
    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error={null}
        pendingTaskIds={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("추가 버튼 클릭 시 입력 폼이 표시된다", async () => {
    const user = userEvent.setup();

    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error={null}
        pendingTaskIds={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    const addButton = screen.getAllByRole("button")[0];
    await user.click(addButton);

    expect(screen.getByPlaceholderText("새 작업...")).toBeInTheDocument();
  });

  it("새 작업을 입력하고 저장하면 onAddTask가 호출된다", async () => {
    const user = userEvent.setup();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error={null}
        pendingTaskIds={[]}
        onAddTask={onAddTask}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    const addButton = screen.getAllByRole("button")[0];
    await user.click(addButton);

    const input = screen.getByPlaceholderText("새 작업...");
    await user.type(input, "새로운 작업");

    const submitButton = screen.getAllByRole("button")[1];
    await user.click(submitButton);

    expect(onAddTask).toHaveBeenCalledWith("새로운 작업");
  });

  it("빈 텍스트는 제출되지 않는다", async () => {
    const user = userEvent.setup();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error={null}
        pendingTaskIds={[]}
        onAddTask={onAddTask}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    const addButton = screen.getAllByRole("button")[0];
    await user.click(addButton);

    const submitButton = screen.getAllByRole("button")[1];
    await user.click(submitButton);

    expect(onAddTask).not.toHaveBeenCalled();
  });

  it("취소 버튼 클릭 시 입력 폼이 닫힌다", async () => {
    const user = userEvent.setup();

    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error={null}
        pendingTaskIds={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    const addButton = screen.getAllByRole("button")[0];
    await user.click(addButton);

    const input = screen.getByPlaceholderText("새 작업...");
    await user.type(input, "작업");

    const cancelButton = screen.getAllByRole("button")[2];
    await user.click(cancelButton);

    expect(screen.queryByPlaceholderText("새 작업...")).not.toBeInTheDocument();
  });

  it("에러 메시지가 있으면 표시된다", () => {
    render(
      <TaskList
        tasks={mockTasks}
        completedCount={1}
        totalCount={2}
        error="작업 추가 실패"
        pendingTaskIds={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    expect(screen.getByText("작업 추가 실패")).toBeInTheDocument();
  });

  it("작업이 없으면 빈 리스트가 표시된다", () => {
    render(
      <TaskList
        tasks={[]}
        completedCount={0}
        totalCount={0}
        error={null}
        pendingTaskIds={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleTaskTimer={vi.fn()}
        onEditTask={vi.fn()}
        formatTaskTime={(s) => `${s}초`}
        getTaskDisplayTime={(task) => task.time}
      />,
    );

    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});