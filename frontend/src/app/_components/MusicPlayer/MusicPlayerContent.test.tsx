import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MusicPlayerContent from "./MusicPlayerContent";
import * as useMusicPlayerModule from "./useMusicPlayer";
import { TRACKS, LOOP_MODES } from "./constants";

vi.mock("./useMusicPlayer");

describe("MusicPlayerContent", () => {
  const mockUseMusicPlayer = {
    isExpanded: true,
    setIsExpanded: vi.fn(),
    isPlaying: false,
    currentTrack: null,
    volume: 0.5,
    setVolume: vi.fn(),
    isMuted: false,
    setIsMuted: vi.fn(),
    audioRef: { current: null },
    handlePlayTrack: vi.fn(),
    handleTogglePlay: vi.fn(),
    handleNext: vi.fn(),
    handlePrev: vi.fn(),
    handleTrackEnd: vi.fn(),
    loopMode: LOOP_MODES.ALL,
    toggleLoopMode: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMusicPlayerModule.useMusicPlayer).mockReturnValue(
      mockUseMusicPlayer,
    );
  });

  it("펼침 모드에서 플레이어 컨트롤이 렌더링된다", () => {
    render(<MusicPlayerContent isExpanded={true} />);

    expect(screen.getByLabelText("Playback Controls")).toBeInTheDocument();
    expect(screen.getByLabelText("Volume Control")).toBeInTheDocument();
  });

  it("트랙이 없으면 재생 중인 곡 없음이 표시된다", () => {
    render(<MusicPlayerContent isExpanded={true} />);

    expect(screen.getByText("♪ 재생 중인 곡 없음")).toBeInTheDocument();
  });

  it("트랙이 선택되면 제목과 아티스트가 표시된다", () => {
    vi.mocked(useMusicPlayerModule.useMusicPlayer).mockReturnValue({
      ...mockUseMusicPlayer,
      currentTrack: TRACKS[0],
    });

    render(<MusicPlayerContent isExpanded={true} />);

    const nowPlaying = screen.getByLabelText("Now Playing");
    expect(nowPlaying).toHaveTextContent(`♪ ${TRACKS[0].title}`);
    expect(nowPlaying).toHaveTextContent(TRACKS[0].artist);
  });

  it("재생 버튼 클릭 시 handleTogglePlay가 호출된다", async () => {
    const user = userEvent.setup();

    render(<MusicPlayerContent isExpanded={true} />);

    const playButton = screen.getByLabelText("Play");
    await user.click(playButton);

    expect(mockUseMusicPlayer.handleTogglePlay).toHaveBeenCalled();
  });

  it("재생 중일 때 일시정지 버튼이 표시된다", () => {
    vi.mocked(useMusicPlayerModule.useMusicPlayer).mockReturnValue({
      ...mockUseMusicPlayer,
      isPlaying: true,
      currentTrack: TRACKS[0],
    });

    render(<MusicPlayerContent isExpanded={true} />);

    expect(screen.getAllByLabelText("Pause")[0]).toBeInTheDocument();
  });

  it("이전 트랙 버튼 클릭 시 handlePrev가 호출된다", async () => {
    const user = userEvent.setup();

    render(<MusicPlayerContent isExpanded={true} />);

    const prevButton = screen.getByLabelText("Previous Track");
    await user.click(prevButton);

    expect(mockUseMusicPlayer.handlePrev).toHaveBeenCalled();
  });

  it("다음 트랙 버튼 클릭 시 handleNext가 호출된다", async () => {
    const user = userEvent.setup();

    render(<MusicPlayerContent isExpanded={true} />);

    const nextButton = screen.getByLabelText("Next Track");
    await user.click(nextButton);

    expect(mockUseMusicPlayer.handleNext).toHaveBeenCalled();
  });

  it("반복 모드 버튼 클릭 시 toggleLoopMode가 호출된다", async () => {
    const user = userEvent.setup();

    render(<MusicPlayerContent isExpanded={true} />);

    const repeatButton = screen.getByLabelText(`Repeat Mode: ${LOOP_MODES.ALL}`);
    await user.click(repeatButton);

    expect(mockUseMusicPlayer.toggleLoopMode).toHaveBeenCalled();
  });

  it("음소거 버튼 클릭 시 setIsMuted가 호출된다", async () => {
    const user = userEvent.setup();

    render(<MusicPlayerContent isExpanded={true} />);

    const muteButton = screen.getByLabelText("Mute");
    await user.click(muteButton);

    expect(mockUseMusicPlayer.setIsMuted).toHaveBeenCalledWith(true);
  });


  it("트랙 리스트가 렌더링된다", () => {
    render(<MusicPlayerContent isExpanded={true} />);

    TRACKS.forEach((track) => {
      expect(screen.getByText(track.title)).toBeInTheDocument();
    });
  });

  it("트랙 클릭 시 handlePlayTrack이 호출된다", async () => {
    const user = userEvent.setup();

    render(<MusicPlayerContent isExpanded={true} />);

    const trackElement = screen.getByText(TRACKS[0].title);
    await user.click(trackElement);

    expect(mockUseMusicPlayer.handlePlayTrack).toHaveBeenCalledWith(TRACKS[0]);
  });

  it("미니 모드에서 간단한 컨트롤이 표시된다", () => {
    render(<MusicPlayerContent isExpanded={false} />);

    expect(screen.getByText("재생 중인 곡 없음")).toBeInTheDocument();
  });

  it("미니 모드에서 현재 트랙이 표시된다", () => {
    vi.mocked(useMusicPlayerModule.useMusicPlayer).mockReturnValue({
      ...mockUseMusicPlayer,
      currentTrack: TRACKS[0],
    });

    render(<MusicPlayerContent isExpanded={false} />);

    const miniMode = document.querySelector(".hidden + div");
    expect(miniMode).toHaveTextContent(`♪ ${TRACKS[0].title}`);
  });

  it("미니 모드에서 재생 버튼이 동작한다", async () => {
    const user = userEvent.setup();

    vi.mocked(useMusicPlayerModule.useMusicPlayer).mockReturnValue({
      ...mockUseMusicPlayer,
      currentTrack: TRACKS[0],
    });

    render(<MusicPlayerContent isExpanded={false} />);

    const playButtons = screen.getAllByLabelText("Play");
    await user.click(playButtons[playButtons.length - 1]);

    expect(mockUseMusicPlayer.handleTogglePlay).toHaveBeenCalled();
  });
});