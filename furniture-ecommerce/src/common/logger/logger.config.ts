import { HttpStatus } from '@nestjs/common';
import type { Params } from 'nestjs-pino';

import { Environment } from '@/enums';

const isDev = process.env.NODE_ENV !== Environment.Production;

export const pinoConfig: Params = {
  pinoHttp: {
    // level flow env — debug on dev, info on production
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

    // pino-pretty run dev only — production always raw JSON
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,

    // auto mask fields sensitive — never log raw
    redact: {
      paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
      censor: '[REDACTED]',
    },

    // serializer normalizes req/res — only logging what is needed.
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.remoteAddress,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },

    // automatically generate requestId if the word "upstream" is not present.
    genReqId: (req) =>
      req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID(),

    // custom log level based on status code and error presence
    customLogLevel: (_req, res, err) => {
      if (err) return 'error';
      if (res.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) return 'error';
      if (res.statusCode >= HttpStatus.BAD_REQUEST) return 'warn';

      return 'info';
    },

    // custom success message format
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,

    // custom error message format
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  },
};
