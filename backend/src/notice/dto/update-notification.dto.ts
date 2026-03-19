import { KoreanNotice, EnglishNotice } from './create-notification.dto';

export class UpdateNotificationDto {
  ko?: Partial<KoreanNotice>;
  en?: Partial<EnglishNotice>;
}
