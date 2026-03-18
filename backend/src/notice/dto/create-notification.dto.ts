export class KoreanNotice {
  title: string;
  content: string;
}

export class EnglishNotice {
  title: string;
  content: string;
}

export class CreateNotificationDto {
  ko: KoreanNotice;
  en: EnglishNotice;
}
