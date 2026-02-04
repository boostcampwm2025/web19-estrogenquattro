import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FocusPanel from "./FocusPanel";

vi.mock("../MusicPlayer/MusicPlayerContent", () => ({
  default: () => <div data-testid="music-player">MusicPlayerContent</div>,
}));

vi.mock("../TasksMenu/TasksMenuContent", () => ({
  default: () => <div data-testid="tasks-menu">TasksMenuContent</div>,
}));

describe("FocusPanel", () => {
  it("초기 상태에서 Tasks 탭이 활성화되어 있다", () => {
    render(<FocusPanel />);

    expect(screen.getByTestId("tasks-menu")).toBeVisible();
  });

  it("Music 탭 클릭 시 Music 콘텐츠가 표시된다", async () => {
    const user = userEvent.setup();
    render(<FocusPanel />);

    await user.click(screen.getByText("Music"));

    expect(screen.getByTestId("music-player")).toBeVisible();
  });

  it("Tasks 탭과 Music 탭을 전환할 수 있다", async () => {
    const user = userEvent.setup();
    render(<FocusPanel />);

    // Music 탭으로 전환
    await user.click(screen.getByText("Music"));
    expect(screen.getByTestId("music-player")).toBeVisible();

    // Tasks 탭으로 전환
    await user.click(screen.getByText("Tasks"));
    expect(screen.getByTestId("tasks-menu")).toBeVisible();
  });

  it("접기 버튼 클릭 시 패널이 접힌다", async () => {
    const user = userEvent.setup();
    render(<FocusPanel />);

    const collapseButton = screen.getByLabelText("패널 접기");
    await user.click(collapseButton);

    expect(screen.getByLabelText("패널 펼치기")).toBeInTheDocument();
  });

  it("접힌 상태에서 펼치기 버튼 클릭 시 패널이 펼쳐진다", async () => {
    const user = userEvent.setup();
    render(<FocusPanel />);

    // 접기
    await user.click(screen.getByLabelText("패널 접기"));
    // 펼치기
    await user.click(screen.getByLabelText("패널 펼치기"));

    expect(screen.getByLabelText("패널 접기")).toBeInTheDocument();
  });
});
