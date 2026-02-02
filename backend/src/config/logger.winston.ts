import { utilities } from 'nest-winston';
import * as winston from 'winston';
import { WinstonTransport as AxiomTransport } from '@axiomhq/winston';

export const createWinstonConfig = (
  nodeEnv: string,
  axiomToken?: string,
  axiomDataset?: string,
  logLevel?: string,
): winston.LoggerOptions => {
  const isProd = nodeEnv === 'production';
  const hasAxiom = Boolean(axiomToken && axiomDataset);
  const level = logLevel || (isProd ? 'info' : 'debug');

  // 운영에서만 Axiom 활성화
  const enableAxiom = isProd && hasAxiom;

  const consoleTransport = new winston.transports.Console({
    level,
    format: isProd
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          utilities.format.nestLike('EstrogenQuattro', {
            prettyPrint: true,
            colors: true,
            appName: true,
          }),
        ),
  });

  const axiomFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const axiomTransport = enableAxiom
    ? new AxiomTransport({
        dataset: axiomDataset!,
        token: axiomToken!,
        level,
        format: axiomFormat,
      })
    : null;

  return {
    level,
    transports: [consoleTransport, ...(axiomTransport ? [axiomTransport] : [])],
    exceptionHandlers: [
      new winston.transports.Console({
        level,
        format: consoleTransport.format,
      }),
      ...(axiomTransport ? [axiomTransport] : []),
    ],
    rejectionHandlers: [
      new winston.transports.Console({
        level,
        format: consoleTransport.format,
      }),
      ...(axiomTransport ? [axiomTransport] : []),
    ],
  };
};
