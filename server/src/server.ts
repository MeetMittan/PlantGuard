import { app } from './app.js';
import { env } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { logger } from './lib/logger.js';
import { ensureUploadDir } from './storage/index.js';

async function bootstrap() {
  try {
    ensureUploadDir();

    // Connect to MongoDB
    await connectDatabase();
    logger.info('Database connected successfully');

    const server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
          geminiModel: env.GEMINI_MODEL,
          aiConfigured: Boolean(env.GEMINI_API_KEY),
        },
        `PlantGuard AI Express Server running at http://localhost:${env.PORT}`,
      );
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Graceful shutdown initiated...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force close after 10s if dangling connections
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error({ err: reason }, 'Unhandled Promise Rejection');
    });
    process.on('uncaughtException', (err) => {
      logger.error({ err }, 'Uncaught Exception');
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to bootstrap PlantGuard AI Server');
    process.exit(1);
  }
}

bootstrap();

