import { ConfigService } from '@nestjs/config';

export function getFrontendUrls(configService: ConfigService): string[] {
  const raw = configService.getOrThrow<string>('FRONTEND_URL');
  const urls = raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error('FRONTEND_URL must include at least one valid URL');
  }

  return urls;
}
