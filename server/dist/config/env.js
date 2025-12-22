import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
// NODE_ENV에 따라 환경변수 파일 로드 (Vite 스타일)
// 우선순위: .env.{NODE_ENV}.local > .env.{NODE_ENV} > .env.local > .env
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(rootDir, `.env.${nodeEnv}.local`) });
dotenv.config({ path: path.join(rootDir, `.env.${nodeEnv}`) });
dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config({ path: path.join(rootDir, '.env') });
const schema = Joi.object({
    // 필수 환경변수
    GITHUB_CLIENT_ID: Joi.string().required(),
    GITHUB_CLIENT_SECRET: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    // 선택 환경변수 (기본값 있음)
    PORT: Joi.number().default(8080),
    FRONTEND_URL: Joi.string().default('http://localhost:5173'),
    GITHUB_CALLBACK_URL: Joi.string().default('http://localhost:8080/auth/github/callback'),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
});
const { error, value } = schema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: false,
});
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}
export const config = value;
//# sourceMappingURL=env.js.map