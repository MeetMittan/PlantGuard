import mongoose, { Schema } from 'mongoose';
import { ensureAllIndexes } from '../indexes.js';
import { logger } from '../../lib/logger.js';

export const name = '001_initial_schema';

export async function up(): Promise<void> {
  logger.info(`Running migration up: ${name}`);
  // Ensures initial collections and indexes are initialized
  await ensureAllIndexes();
  logger.info(`Migration ${name} completed successfully.`);
}

export async function down(): Promise<void> {
  logger.warn(`Migration rollback requested for ${name}`);
  // No-op for safety in production
}

