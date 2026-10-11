import { connectDatabase, disconnectDatabase } from './connection.js';
import * as models from '../models/index.js';
import { logger } from '../lib/logger.js';

export async function ensureAllIndexes() {
  await connectDatabase();
  logger.info('Ensuring all MongoDB indexes...');

  const modelEntries = Object.entries(models).filter(
    ([name, val]) => typeof val === 'function' && 'createIndexes' in val && name !== 'getCanonicalPair',
  );

  for (const [name, model] of modelEntries) {
    try {
      await (model as any).createIndexes();
      logger.info(`Indexes verified for model: ${name}`);
    } catch (err) {
      logger.error({ model: name, err }, `Failed to create indexes for model ${name}`);
      throw err;
    }
  }

  logger.info('All model indexes successfully created.');
}

if (process.argv[1]?.endsWith('indexes.ts') || process.argv[1]?.endsWith('indexes.js')) {
  (async () => {
    try {
      await ensureAllIndexes();
      await disconnectDatabase();
      console.log('✅ All MongoDB indexes ensured successfully!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Failed ensuring indexes:', err);
      process.exit(1);
    }
  })();
}

