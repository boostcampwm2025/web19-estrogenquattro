import Joi from 'joi';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const schema = Joi.object({
  // 필수 환경변수
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),

  // 선택 환경변수 (기본값 있음)
  PORT: Joi.number().default(8080),
  FRONTEND_URL: Joi.string().default('http://localhost:5173'),
  GITHUB_CALLBACK_URL: Joi.string().default(
    'http://localhost:8080/auth/github/callback',
  ),
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

export interface Config {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  PORT: number;
  FRONTEND_URL: string;
  GITHUB_CALLBACK_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

export const config: Config = value as Config;
