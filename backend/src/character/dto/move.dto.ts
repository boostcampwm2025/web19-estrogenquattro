import {Direction} from "../types/direction.type";

export class MoveReq {
  roomId: string;
  x: number;
  y: number;
  direction: Direction;
}