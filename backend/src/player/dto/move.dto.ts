import { Direction } from '../types/direction.type';

export class MoveReq {
  roomId: string;
  userId: string;
  x: number;
  y: number;
  isMoving: boolean;
  direction: Direction;
  timestamp: number;
}
