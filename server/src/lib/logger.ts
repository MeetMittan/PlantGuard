import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { env } from '../config/index.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'GEMINI_API_KEY',
      'image',
      'buffer',
      'base64',
    ],
    remove: true,
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`;
  },
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health' || req.url === '/api/health',
  },
});

