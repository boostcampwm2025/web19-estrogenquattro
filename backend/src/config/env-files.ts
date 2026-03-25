import { existsSync } from 'fs';
import { resolve } from 'path';

export const ENV_FILE_PATHS = [
  '.env.production',
  '.env.development',
  '.env.local',
  '.env',
] as const;

let envFilesLoaded = false;

export function loadEnvFilesOnce(): void {
  if (envFilesLoaded) {
    return;
  }

  const loadEnvFile = (
    process as NodeJS.Process & {
      loadEnvFile?: (path?: string) => void;
    }
  ).loadEnvFile;

  if (!loadEnvFile) {
    envFilesLoaded = true;
    return;
  }

  for (const envFilePath of ENV_FILE_PATHS) {
    const resolvedPath = resolve(process.cwd(), envFilePath);

    if (!existsSync(resolvedPath)) {
      continue;
    }

    loadEnvFile(resolvedPath);
  }

  envFilesLoaded = true;
}
