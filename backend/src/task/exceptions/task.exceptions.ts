import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from '../../common/exceptions/base-business.exception';
import { ErrorCodes } from '../../common/error-codes';

export class TaskNotFoundException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_NOT_FOUND,
      '태스크를 찾을 수 없습니다.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TaskNotOwnedException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_NOT_OWNED,
      '본인의 태스크만 삭제할 수 있습니다.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class TaskFocusingException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_FOCUSING,
      '집중 중인 태스크는 삭제할 수 없습니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
