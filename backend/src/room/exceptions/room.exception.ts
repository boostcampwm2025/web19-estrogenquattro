import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from '../../common/exceptions/base-business.exception';
import { ErrorCodes } from '../../common/error-codes';

export class RoomNotFoundException extends BaseBusinessException {
  constructor() {
    super(ErrorCodes.ROOM_NOT_FOUND, 'Room not found', HttpStatus.NOT_FOUND);
  }
}

export class RoomFullException extends BaseBusinessException {
  constructor() {
    super(ErrorCodes.ROOM_FULL, 'Room is full', HttpStatus.BAD_REQUEST);
  }
}
