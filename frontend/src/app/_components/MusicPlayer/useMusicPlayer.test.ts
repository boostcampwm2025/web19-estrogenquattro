import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMusicPlayer } from "./useMusicPlayer";
import { LOOP_MODES, STORAGE_KEYS, TRACKS } from "./constants";

describe("useMusicPlayer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("초기 상태", () => {
    it("기본값으로 초기화된다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      expect(result.current.isExpanded).toBe(true);
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentTrack).toBeNull();
      expect(result.current.volume).toBe(0.5);
      expect(result.current.isMuted).toBe(false);
      expect(result.current.loopMode).toBe(LOOP_MODES.ALL);
    });

    it("localStorage에 저장된 볼륨을 불러온다", () => {
      localStorage.setItem(STORAGE_KEYS.VOLUME, "0.8");

      const { result } = renderHook(() => useMusicPlayer());

      expect(result.current.volume).toBe(0.8);
    });

    it("localStorage에 저장된 반복 모드를 불러온다", () => {
      localStorage.setItem(STORAGE_KEYS.LOOP_MODE, LOOP_MODES.ONE);

      const { result } = renderHook(() => useMusicPlayer());

      expect(result.current.loopMode).toBe(LOOP_MODES.ONE);
    });

    it("localStorage에 저장된 마지막 트랙을 불러온다", () => {
      localStorage.setItem(STORAGE_KEYS.LAST_TRACK_ID, TRACKS[0].id);

      const { result } = renderHook(() => useMusicPlayer());

      expect(result.current.currentTrack).toEqual(TRACKS[0]);
    });
  });

  describe("트랙 재생", () => {
    it("새 트랙을 재생하면 트랙이 변경되고 재생 상태가 된다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[1]);
      });

      expect(result.current.currentTrack).toEqual(TRACKS[1]);
      expect(result.current.isPlaying).toBe(true);
    });

    it("현재 재생 중인 트랙을 다시 클릭하면 일시정지된다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[0]);
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.handlePlayTrack(TRACKS[0]);
      });

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe("재생 토글", () => {
    it("트랙이 없으면 첫 번째 트랙을 재생한다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handleTogglePlay();
      });

      expect(result.current.currentTrack).toEqual(TRACKS[0]);
      expect(result.current.isPlaying).toBe(true);
    });

    it("트랙이 있으면 재생 상태를 토글한다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[0]);
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.handleTogglePlay();
      });

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe("다음 트랙", () => {
    it("다음 트랙으로 이동한다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[0]);
      });

      act(() => {
        result.current.handleNext();
      });

      expect(result.current.currentTrack).toEqual(TRACKS[1]);
      expect(result.current.isPlaying).toBe(true);
    });

    it("마지막 트랙에서 다음을 누르면 첫 트랙으로 이동한다", () => {
      const { result } = renderHook(() => useMusicPlayer());
      const lastTrack = TRACKS[TRACKS.length - 1];

      act(() => {
        result.current.handlePlayTrack(lastTrack);
      });

      act(() => {
        result.current.handleNext();
      });

      expect(result.current.currentTrack).toEqual(TRACKS[0]);
    });
  });

  describe("이전 트랙", () => {
    it("이전 트랙으로 이동한다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[1]);
      });

      act(() => {
        result.current.handlePrev();
      });

      expect(result.current.currentTrack).toEqual(TRACKS[0]);
      expect(result.current.isPlaying).toBe(true);
    });

    it("첫 트랙에서 이전을 누르면 마지막 트랙으로 이동한다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[0]);
      });

      act(() => {
        result.current.handlePrev();
      });

      expect(result.current.currentTrack).toEqual(TRACKS[TRACKS.length - 1]);
    });
  });

  describe("반복 모드", () => {
    it("OFF -> ALL -> ONE -> OFF 순서로 토글된다", () => {
      localStorage.setItem(STORAGE_KEYS.LOOP_MODE, LOOP_MODES.OFF);
      const { result } = renderHook(() => useMusicPlayer());

      expect(result.current.loopMode).toBe(LOOP_MODES.OFF);

      act(() => {
        result.current.toggleLoopMode();
      });

      expect(result.current.loopMode).toBe(LOOP_MODES.ALL);

      act(() => {
        result.current.toggleLoopMode();
      });

      expect(result.current.loopMode).toBe(LOOP_MODES.ONE);

      act(() => {
        result.current.toggleLoopMode();
      });

      expect(result.current.loopMode).toBe(LOOP_MODES.OFF);
    });
  });

  describe("볼륨 조절", () => {
    it("볼륨을 변경하면 localStorage에 저장된다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.setVolume(0.7);
      });

      expect(result.current.volume).toBe(0.7);
      expect(localStorage.getItem(STORAGE_KEYS.VOLUME)).toBe("0.7");
    });

    it("음소거 상태를 토글할 수 있다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      expect(result.current.isMuted).toBe(false);

      act(() => {
        result.current.setIsMuted(true);
      });

      expect(result.current.isMuted).toBe(true);
    });
  });

  describe("localStorage 저장", () => {
    it("트랙이 변경되면 localStorage에 저장된다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.handlePlayTrack(TRACKS[2]);
      });

      expect(localStorage.getItem(STORAGE_KEYS.LAST_TRACK_ID)).toBe(
        TRACKS[2].id,
      );
    });

    it("반복 모드가 변경되면 localStorage에 저장된다", () => {
      const { result } = renderHook(() => useMusicPlayer());

      act(() => {
        result.current.toggleLoopMode();
      });

      expect(localStorage.getItem(STORAGE_KEYS.LOOP_MODE)).toBe(
        result.current.loopMode,
      );
    });
  });
});
