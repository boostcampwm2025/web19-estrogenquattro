import type { Direction } from "../types/direction";
import { DIRECTION } from "../constants/direction";

/**
 * Binary 이동 데이터 프로토콜 (msgpack 파서 적용)
 *
 * 12 bytes ArrayBuffer:
 * ┌──────────┬──────────┬───────────┬──────────┬──────────┐
 * │ x (4B)   │ y (4B)   │ dir (1B)  │ move (1B)│ pad (2B) │
 * │ Float32  │ Float32  │ Uint8     │ Uint8    │          │
 * └──────────┴──────────┴───────────┴──────────┴──────────┘
 */

const BUFFER_SIZE = 12;

// Direction ↔ number 매핑
const directionToNum: Record<Direction, number> = {
  [DIRECTION.STOP]: 0,
  [DIRECTION.UP]: 1,
  [DIRECTION.DOWN]: 2,
  [DIRECTION.LEFT]: 3,
  [DIRECTION.RIGHT]: 4,
  [DIRECTION.LEFT_UP]: 5,
  [DIRECTION.LEFT_DOWN]: 6,
  [DIRECTION.RIGHT_UP]: 7,
  [DIRECTION.RIGHT_DOWN]: 8,
};

const numToDirection: Direction[] = [
  DIRECTION.STOP,
  DIRECTION.UP,
  DIRECTION.DOWN,
  DIRECTION.LEFT,
  DIRECTION.RIGHT,
  DIRECTION.LEFT_UP,
  DIRECTION.LEFT_DOWN,
  DIRECTION.RIGHT_UP,
  DIRECTION.RIGHT_DOWN,
];

export interface MoveData {
  x: number;
  y: number;
  direction: Direction;
  isMoving: boolean;
}

export function encodeMoveData(
  x: number,
  y: number,
  direction: Direction,
  isMoving: boolean,
): ArrayBuffer {
  const buffer = new ArrayBuffer(BUFFER_SIZE);
  const view = new DataView(buffer);

  view.setFloat32(0, x, true); // little-endian
  view.setFloat32(4, y, true);
  view.setUint8(8, directionToNum[direction] ?? 0);
  view.setUint8(9, isMoving ? 1 : 0);

  return buffer;
}

export function decodeMoveData(buffer: ArrayBuffer): MoveData {
  const view = new DataView(buffer);

  const x = view.getFloat32(0, true);
  const y = view.getFloat32(4, true);
  const dirNum = view.getUint8(8);
  const isMoving = view.getUint8(9) === 1;
  const direction = numToDirection[dirNum] ?? DIRECTION.STOP;

  return { x, y, direction, isMoving };
}
