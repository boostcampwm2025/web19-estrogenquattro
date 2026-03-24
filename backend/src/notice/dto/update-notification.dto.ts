import { KoreanNotice, EnglishNotice } from './create-notification.dto';

export class UpdateNoticeDto {
  ko?: Partial<KoreanNotice>;
  en?: Partial<EnglishNotice>;
}
