import { useState, useRef, useEffect } from "react";
import { LOOP_MODES, STORAGE_KEYS, TRACKS } from "./constants";
import { LoopMode, Track } from "./types";

function getStoredVolume(): number {
  if (typeof window === "undefined") return 0.5;

  const stored = localStorage.getItem(STORAGE_KEYS.VOLUME);
  if (stored === null) return 0.5;
  const parsed = parseFloat(stored);
  return Number.isNaN(parsed) ? 0.5 : Math.max(0, Math.min(1, parsed));
}

function getStoredLoopMode(): LoopMode {
  if (typeof window === "undefined") return LOOP_MODES.ALL;
  const stored = localStorage.getItem(STORAGE_KEYS.LOOP_MODE);
  if (
    stored === LOOP_MODES.OFF ||
    stored === LOOP_MODES.ALL ||
    stored === LOOP_MODES.ONE
  ) {
    return stored;
  }
  return LOOP_MODES.ALL;
}

function getStoredTrack(): Track | null {
  if (typeof window === "undefined") return null;
  const storedId = localStorage.getItem(STORAGE_KEYS.LAST_TRACK_ID);
  if (!storedId) return null;
  return TRACKS.find((t) => t.id === storedId) || null;
}

export function useMusicPlayer() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(
    getStoredTrack,
  );
  const [volume, setVolume] = useState(getStoredVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>(getStoredLoopMode);

  const audioRef = useRef<HTMLAudioElement>(null);

  // 볼륨 조절 이펙트
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // localStorage 저장 이펙트
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME, String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOOP_MODE, loopMode);
  }, [loopMode]);

  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem(STORAGE_KEYS.LAST_TRACK_ID, currentTrack.id);
    }
  }, [currentTrack]);

  // 재생 상태 조절 이펙트
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleTogglePlay = () => {
    if (!currentTrack && TRACKS.length > 0) {
      setCurrentTrack(TRACKS[0]);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleNext = () => {
    if (!currentTrack) {
      setCurrentTrack(TRACKS[0]);
      setIsPlaying(true);
      return;
    }

    const currentIndex = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % TRACKS.length;
    setCurrentTrack(TRACKS[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (!currentTrack) {
      setCurrentTrack(TRACKS[0]);
      setIsPlaying(true);
      return;
    }

    const currentIndex = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = currentIndex <= 0 ? TRACKS.length - 1 : currentIndex - 1;
    setCurrentTrack(TRACKS[prevIndex]);
    setIsPlaying(true);
  };

  const toggleLoopMode = () => {
    setLoopMode((prev) => {
      if (prev === LOOP_MODES.OFF) return LOOP_MODES.ALL;
      if (prev === LOOP_MODES.ALL) return LOOP_MODES.ONE;
      return LOOP_MODES.OFF;
    });
  };

  const handleTrackEnd = () => {
    if (loopMode === LOOP_MODES.ONE) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (loopMode === LOOP_MODES.OFF) {
      // 반복 없음 (마지막 곡이면 정지)
      if (!currentTrack) return;
      const currentIndex = TRACKS.findIndex((t) => t.id === currentTrack.id);
      const isLastTrack = currentIndex === TRACKS.length - 1;

      if (isLastTrack) {
        setIsPlaying(false);
      } else {
        handleNext();
      }
    } else if (loopMode === LOOP_MODES.ALL) {
      handleNext();
    } else {
      handleNext();
    }
  };

  return {
    isExpanded,
    setIsExpanded,
    isPlaying,
    currentTrack,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    audioRef,
    handlePlayTrack,
    handleTogglePlay,
    handleNext,
    handlePrev,
    handleTrackEnd,
    loopMode,
    toggleLoopMode,
  };
}
