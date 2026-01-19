import { LOOP_MODES, TRACKS } from "./constants";

// 음악 타입 정의
export type Track = (typeof TRACKS)[number];

// 반복 모드 타입 정의
export type LoopMode = (typeof LOOP_MODES)[keyof typeof LOOP_MODES];
