import { CreateNotificationDto } from './create-notification.dto';

export class UpdateNotificationDto implements Partial<CreateNotificationDto> {
  title?: string;
  content?: string;
}
