/**
 * 부하 테스트용 JWT 토큰 생성 스크립트
 *
 * 사용법: npx ts-node artillery/generate-tokens.ts
 *
 * 환경변수:
 * - JWT_SECRET: JWT 서명에 사용할 시크릿 (필수)
 * - LOAD_TEST_USER_COUNT: 생성할 테스트 유저 수 (기본값: 50)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// dotenv 없이 직접 .env 파일 파싱
function loadEnv(): Record<string, string> {
  const envFiles = ['.env.production', '.env.local', '.env'];
  const env: Record<string, string> = {};

  for (const envFile of envFiles) {
    const envPath = path.join(__dirname, '..', envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            env[key] = valueParts.join('=');
          }
        }
      }
    }
  }

  return env;
}

// 간단한 JWT 구현 (외부 의존성 없이)
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const LOAD_TEST_USER_COUNT = 50;
const LOAD_TEST_SOCIAL_ID_START = 900000000;

function main() {
  const env = loadEnv();
  const jwtSecret = env['JWT_SECRET'];

  if (!jwtSecret) {
    console.error('❌ JWT_SECRET 환경변수가 설정되지 않았습니다.');
    console.error('   .env.local 또는 .env.production 파일을 확인하세요.');
    process.exit(1);
  }

  console.log(`🔑 JWT_SECRET 로드 완료 (길이: ${jwtSecret.length})`);
  console.log(`👥 ${LOAD_TEST_USER_COUNT}명의 테스트 유저 토큰 생성 중...`);

  const tokens: string[] = [];

  for (let i = 0; i < LOAD_TEST_USER_COUNT; i++) {
    const socialId = LOAD_TEST_SOCIAL_ID_START + i;
    const githubId = `loadtest_${socialId}`;

    const payload = {
      sub: githubId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7일 후 만료
    };

    const token = createJwt(payload, jwtSecret);
    tokens.push(token);
  }

  // CSV 파일 생성
  const csvContent = ['jwt', ...tokens].join('\n');
  const csvPath = path.join(__dirname, 'users.csv');
  fs.writeFileSync(csvPath, csvContent);

  console.log(`✅ ${tokens.length}개의 JWT 토큰 생성 완료`);
  console.log(`📄 저장 위치: ${csvPath}`);

  // 토큰 샘플 출력
  console.log('\n📝 토큰 샘플 (첫 번째):');
  console.log(tokens[0].substring(0, 50) + '...');
}

main();