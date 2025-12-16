import { Direction } from '../types/direction.type';

export class MoveReq {
  roomId: string;
  direction: Direction;
}
