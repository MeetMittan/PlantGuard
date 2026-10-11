import mongoose, { Schema } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import { logger } from '../../lib/logger.js';
import * as migration001 from './001_initial_schema.js';

interface IMigrationDoc {
  name: string;
  executedAt: Date;
}

const MigrationRecordSchema = new Schema<IMigrationDoc>({
  name: { type: String, required: true, unique: true },
  executedAt: { type: Date, default: Date.now },
});

const MigrationRecord = mongoose.model<IMigrationDoc>('_Migration', MigrationRecordSchema);

const registeredMigrations = [
  migration001,
];

export async function runMigrations() {
  await connectDatabase();
  logger.info('Checking database migrations...');

  for (const migration of registeredMigrations) {
    const existing = await MigrationRecord.findOne({ name: migration.name });
    if (!existing) {
      logger.info(`Applying pending migration: ${migration.name}`);
      await migration.up();
      await MigrationRecord.create({ name: migration.name, executedAt: new Date() });
      logger.info(`Recorded migration: ${migration.name}`);
    } else {
      logger.info(`Migration already applied: ${migration.name} at ${existing.executedAt.toISOString()}`);
    }
  }

  logger.info('All database migrations are up to date.');
}

if (process.argv[1]?.endsWith('runner.ts') || process.argv[1]?.endsWith('runner.js')) {
  (async () => {
    try {
      await runMigrations();
      await disconnectDatabase();
      console.log('✅ Migrations applied successfully!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    }
  })();
}

