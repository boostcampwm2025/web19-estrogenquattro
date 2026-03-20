export class KoreanNotice {
  title: string;
  content: string;
}

export class EnglishNotice {
  title: string;
  content: string;
}

export class CreateNoticeDto {
  ko: KoreanNotice;
  en: EnglishNotice;
}

