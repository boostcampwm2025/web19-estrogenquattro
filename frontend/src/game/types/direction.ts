import { DIRECTION } from "../constants/direction";

export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];
