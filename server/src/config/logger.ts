import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// 개발용 커스텀 포맷
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `[${timestamp}] ${level}: ${message} ${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    // 콘솔 출력 (개발 환경에서만)
    ...(process.env.NODE_ENV !== 'production'
      ? [
          new winston.transports.Console({
            format: combine(
              colorize(),
              timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              devFormat,
            ),
          }),
        ]
      : []),

    // 파일 출력
    new winston.transports.File({
      dirname: 'logs',
      filename: 'app.log',
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
    }),
  ],
});
