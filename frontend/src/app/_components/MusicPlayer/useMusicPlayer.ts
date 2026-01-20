import { useState, useRef, useEffect } from "react";
import { LOOP_MODES, TRACKS } from "./constants";
import { LoopMode, Track } from "./types";

export function useMusicPlayer() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>(LOOP_MODES.OFF);

  const audioRef = useRef<HTMLAudioElement>(null);

  // 볼륨 조절 이펙트
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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
