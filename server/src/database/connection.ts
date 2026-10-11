import mongoose from 'mongoose';
import { env } from '../config/index.js';
import { logger } from '../lib/logger.js';

let isConnecting = false;

export async function connectDatabase(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (isConnecting) {
    return mongoose;
  }

  isConnecting = true;
  try {
    mongoose.connection.on('connected', () => {
      logger.info({ uri: uri.replace(/:[^:]*@/, ':****@') }, 'Connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ err: err.message }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    return mongoose;
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : error }, 'Failed to connect to MongoDB');
    throw error;
  } finally {
    isConnecting = false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function checkDatabaseHealth(): Promise<{ status: 'connected' | 'disconnected'; details?: string }> {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      return { status: 'connected' };
    }
    return { status: 'disconnected', details: `ReadyState is ${mongoose.connection.readyState}` };
  } catch (error) {
    return {
      status: 'disconnected',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

// Standalone execution for `npm run db:check`
if (process.argv[1]?.endsWith('connection.ts') || process.argv[1]?.endsWith('connection.js')) {
  (async () => {
    try {
      console.log(`Checking MongoDB connection to: ${env.MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);
      await connectDatabase();
      const health = await checkDatabaseHealth();
      if (health.status === 'connected') {
        console.log('✅ MongoDB connection verified successfully!');
        await disconnectDatabase();
        process.exit(0);
      } else {
        console.error('❌ MongoDB ping failed:', health.details);
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Failed to connect to MongoDB:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  })();
}

