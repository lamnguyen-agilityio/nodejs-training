import { HttpStatus, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { Environment } from '@/common/enums';
import type { AppConfig } from '@/config';

export const createLoggerModule = (): DynamicModule =>
  LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const { nodeEnv, logLevel } = configService.getOrThrow<AppConfig>('app');
      const isDev = nodeEnv !== Environment.Production;

      return {
        pinoHttp: {
          // level flow env — debug on dev, info on production.
          level: logLevel ?? (isDev ? 'debug' : 'info'),

          // pino-pretty run dev only — production always raw JSON.
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

          // auto mask fields sensitive — never log raw.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.token',
              '*.email',
              '*.userId',
              '*.provider',
            ],
            censor: '[REDACTED]',
          },

          // serializer normalizes req/res — only logging what is needed.
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res) => ({ statusCode: res.statusCode }),
          },

          // automatically generate requestId if the word "upstream" is not present.
          genReqId: (req, res) => {
            const existingId = req.headers['x-correlation-id'] ?? req.headers['x-request-id'];

            if (existingId) return existingId;

            const id = crypto.randomUUID();
            res.setHeader('X-Request-Id', id);

            return id;
          },

          // custom received message format.
          customReceivedMessage: (req) => `→ ${req.method} ${req.url}`,

          // custom log level based on status code and error presence.
          customLogLevel: (_req, res, err) => {
            if (err) return 'error';
            if (res.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) return 'error';
            if (res.statusCode >= HttpStatus.BAD_REQUEST) return 'warn';

            return 'info';
          },

          // custom success message format.
          customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,

          // custom error message format.
          customErrorMessage: (req, res, err) =>
            `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
        },
      };
    },
  });
