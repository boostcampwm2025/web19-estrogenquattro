"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat1,
  Repeat,
} from "lucide-react";
import { useMusicPlayer } from "./useMusicPlayer";
import { LOOP_MODES, TRACKS } from "./constants";
import { useTranslation } from "react-i18next";

interface MusicPlayerContentProps {
  isExpanded: boolean;
}

export default function MusicPlayerContent({
  isExpanded,
}: MusicPlayerContentProps) {
  const { t } = useTranslation("ui");
  const {
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
  } = useMusicPlayer();

  const handleCanPlay = () => {
    if (isPlaying && audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        void playPromise.catch(() => {
          // 필요시 재생 실패 상태 처리
        });
      }
    }
  };

  return (
    <>
      {/* audio element - 항상 마운트됨 */}
      <audio
        ref={audioRef}
        src={currentTrack?.src}
        onEnded={handleTrackEnd}
        onCanPlay={handleCanPlay}
      />

      {/* 펼침 모드 */}
      <div className={isExpanded ? "block" : "hidden"}>
        {/* 현재 재생 정보 */}
        <section
          className="mb-3 border-2 border-amber-900 bg-white/50 p-2"
          aria-label="Now Playing"
        >
          {currentTrack ? (
            <>
              <p className="truncate text-xs font-bold text-amber-900">
                ♪ {currentTrack.title}
              </p>
              <p className="truncate text-xs text-amber-700">
                {currentTrack.artist}
              </p>
            </>
          ) : (
            <p className="truncate text-xs font-bold text-amber-700">
              ♪ {t("focusPanel.music.noTrack")}
            </p>
          )}
        </section>

        {/* 재생 컨트롤러 */}
        <div
          className="mb-3 flex items-center justify-between"
          role="group"
          aria-label="Playback Controls"
        >
          {/* 반복 버튼 */}
          <button
            onClick={toggleLoopMode}
            aria-label={`Repeat Mode: ${loopMode}`}
            className={`flex h-8 w-8 cursor-pointer items-center justify-start transition-colors ${
              loopMode === LOOP_MODES.OFF
                ? "text-amber-500 hover:text-amber-900"
                : "text-amber-900"
            }`}
          >
            {loopMode === LOOP_MODES.ONE ? (
              <Repeat1 className="h-4 w-4" />
            ) : (
              <Repeat className="h-4 w-4" />
            )}
          </button>

          {/* 중앙 재생 제어 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous Track"
              className="border-retro-border-dark bg-retro-button-bg hover:bg-retro-button-hover flex h-8 w-8 cursor-pointer items-center justify-center border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <SkipBack className="text-retro-button-text h-3 w-3" />
            </button>

            <button
              onClick={handleTogglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="border-retro-border-dark bg-retro-button-bg hover:bg-retro-button-hover flex h-8 w-8 cursor-pointer items-center justify-center border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-px active:translate-y-px active:shadow-none"
            >
              {isPlaying ? (
                <Pause className="text-retro-button-text h-4 w-4" />
              ) : (
                <Play className="text-retro-button-text h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleNext}
              aria-label="Next Track"
              className="border-retro-border-dark bg-retro-button-bg hover:bg-retro-button-hover flex h-8 w-8 cursor-pointer items-center justify-center border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-px active:translate-y-px active:shadow-none"
            >
              <SkipForward className="text-retro-button-text h-3 w-3" />
            </button>
          </div>

          {/* 가상 버튼(중앙 정렬용) */}
          <div className="w-8" aria-hidden="true" />
        </div>

        {/* 볼륨 조절 영역 */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
            className="cursor-pointer text-amber-900 hover:text-amber-700"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            aria-label="Volume Control"
            className="h-2 flex-1 cursor-pointer appearance-none bg-amber-300/60 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-amber-700"
          />
        </div>

        {/* 트랙 리스트 */}
        <ul className="retro-scrollbar max-h-32 overflow-y-auto border-2 border-amber-900 bg-white/50">
          {TRACKS.map((track) => (
            <li
              key={track.id}
              onClick={() => handlePlayTrack(track)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePlayTrack(track);
                }
              }}
              role="button"
              tabIndex={0}
              className={`cursor-pointer p-2 last:border-b-0 ${
                currentTrack?.id === track.id
                  ? "bg-retro-button-bg/10"
                  : "hover:bg-amber-100"
              }`}
            >
              <div className="flex items-center gap-2">
                {currentTrack?.id === track.id && isPlaying ? (
                  <span className="text-xs text-amber-900" aria-hidden="true">
                    ▶
                  </span>
                ) : (
                  <span className="text-xs opacity-0" aria-hidden="true">
                    ▶
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-amber-900">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-amber-700">
                    {track.artist}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 미니 모드 */}
      <div className={!isExpanded ? "block" : "hidden"}>
        {currentTrack ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePlay();
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="cursor-pointer text-amber-900 hover:text-amber-700"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <p className="flex-1 truncate text-sm font-semibold text-amber-900">
              ♪ {currentTrack.title}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-amber-700">{t("focusPanel.music.noTrack")}</p>
          </div>
        )}
      </div>
    </>
  );
}
