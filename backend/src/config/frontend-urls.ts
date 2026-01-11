import { ConfigService } from '@nestjs/config';

export function getFrontendUrls(configService: ConfigService): string[] {
  const raw = configService.getOrThrow<string>('FRONTEND_URL').trim();
  if (!raw) {
    throw new Error('FRONTEND_URL must be a non-empty URL');
  }
  if (raw.includes(',')) {
    throw new Error('FRONTEND_URL must be a single URL');
  }

  return [raw];
}
