import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // 필수 환경변수
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),

  // 선택 환경변수 (기본값 있음)
  PORT: Joi.number().default(8080),
  FRONTEND_URL: Joi.string()
    .pattern(/^[^,]+$/)
    .default('http://localhost:8080'),
  GITHUB_CALLBACK_URL: Joi.string().default(
    'http://localhost:8080/auth/github/callback',
  ),

  // 맵 에셋 경로 (미설정 시 코드에서 __dirname 기반 자동 계산)
  ASSETS_PATH: Joi.string().optional(),
});
