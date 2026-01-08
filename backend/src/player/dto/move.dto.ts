import { Direction } from '../types/direction.type';

export class MoveReq {
  userId: string;
  x: number;
  y: number;
  isMoving: boolean;
  direction: Direction;
  timestamp: number;
}
