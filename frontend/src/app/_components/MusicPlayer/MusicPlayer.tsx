"use client";

import {
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Repeat1,
  Repeat,
} from "lucide-react";
import { useMusicPlayer } from "./useMusicPlayer";
import { LOOP_MODES, TRACKS } from "./constants";

export default function MusicPlayer() {
  const {
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
  } = useMusicPlayer();

  return (
    <>
      <audio
        ref={audioRef}
        src={currentTrack?.src}
        onEnded={handleTrackEnd}
        onCanPlay={() => {
          if (isPlaying && audioRef.current) {
            audioRef.current.play();
          }
        }}
      />

      {/* 전체 위젯을 감싸는 독립적인 구획 */}
      <section className="w-64" aria-label="Music Player Widget">
        {/* 플레이어 카드 본문 */}
        <article className="border-retro-border-dark bg-retro-bg-primary shadow-retro-xl border-4 p-4">
          {/* 상단 헤더 영역 */}
          <header
            className={`flex cursor-pointer items-center justify-between select-none ${
              isExpanded ? "mb-4" : "mb-0"
            }`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <Music className="text-retro-text-primary h-4 w-4" />
              <h2 className="text-retro-text-primary text-sm font-bold">
                MUSIC
              </h2>
            </div>
            <button
              type="button"
              className="text-retro-text-primary hover:text-retro-text-secondary cursor-pointer"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </header>

          {/* 확장된 콘텐츠 영역 */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isExpanded
                ? "max-h-96 opacity-100"
                : "max-h-0 overflow-hidden opacity-0"
            }`}
          >
            {/* 현재 재생 정보 */}
            <section
              className="bg-retro-bg-secondary border-retro-border-dark mb-3 border-2 p-2"
              aria-label="Now Playing"
            >
              {currentTrack ? (
                <>
                  <p className="text-retro-text-primary truncate text-xs font-bold">
                    ♪ {currentTrack.title}
                  </p>
                  <p className="text-retro-text-tertiary truncate text-xs">
                    {currentTrack.artist}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-retro-text-tertiary truncate text-xs font-bold">
                    ♪ 재생 중인 곡 없음
                  </p>
                </>
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
                    ? "text-retro-text-tertiary hover:text-retro-text-primary"
                    : "text-retro-text-primary"
                }`}
              >
                {loopMode === LOOP_MODES.ONE ? (
                  <Repeat1 className="h-4 w-4" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
              </button>

              {/* 2. [중앙] 재생 제어 버튼 3개 */}
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
                aria-label={isMuted ? "Unmute" : "Mute"}
                className="text-retro-text-primary hover:text-retro-text-secondary cursor-pointer"
              >
                {isMuted ? (
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
                className="h-2 flex-1 cursor-pointer appearance-none bg-amber-200 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-amber-700"
              />
            </div>

            {/* 트랙 리스트 */}
            <ul className="border-retro-border-dark retro-scrollbar max-h-32 overflow-y-auto border-2 bg-white/50">
              {TRACKS.map((track) => (
                <li
                  key={track.id}
                  onClick={() => handlePlayTrack(track)}
                  role="button"
                  className={`cursor-pointer border-b border-amber-200 p-2 last:border-b-0 ${
                    currentTrack?.id === track.id
                      ? "bg-amber-200"
                      : "hover:bg-amber-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {currentTrack?.id === track.id && isPlaying ? (
                      <span className="text-xs" aria-hidden="true">
                        ▶
                      </span>
                    ) : (
                      <span className="text-xs opacity-0" aria-hidden="true">
                        ▶
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-retro-text-primary truncate text-xs font-bold">
                        {track.title}
                      </p>
                      <p className="text-retro-text-tertiary truncate text-xs">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 접혔을 때 미니 플레이어 */}
          {!isExpanded && currentTrack && (
            <footer className="border-retro-border-light mt-3 flex items-center gap-2 border-t pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePlay();
                }}
                className="text-retro-text-primary hover:text-retro-text-secondary cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <p className="text-retro-text-primary flex-1 truncate text-sm font-semibold">
                ♪ {currentTrack.title}
              </p>
            </footer>
          )}
        </article>
      </section>
    </>
  );
}
