import cors from 'cors';
import { env } from '../config/index.js';
import { AppServerError } from '../errors.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (env.allowedOrigins.includes('*') || env.allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true);
    }

    callback(new AppServerError('FORBIDDEN', `Origin '${origin}' not allowed by CORS policy`, 403));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
});
