import { utilities } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig: winston.LoggerOptions = {
  transports: [
    ...(process.env.NODE_ENV !== 'production'
      ? [
          new winston.transports.Console({
            level: 'debug',
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              utilities.format.nestLike('web19', {
                prettyPrint: true,
                colors: true,
                appName: true,
              }),
            ),
          }),
        ]
      : []),

    new winston.transports.File({
      dirname: 'logs',
      filename: 'app.log',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
      ),
    }),
  ],
};
