import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/index.js';
import { logger } from '../lib/logger.js';

const uploadDirectory = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

export function ensureUploadDir(): void {
  if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
    logger.info({ path: uploadDirectory }, 'Created upload storage directory');
  }
}

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface StoredFile {
  filename: string;
  absolutePath: string;
  url: string;
  size: number;
  mimeType: string;
}

export async function saveFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
): Promise<StoredFile> {
  ensureUploadDir();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Allowed types: JPEG, PNG, WEBP.`);
  }

  const ext = EXTENSION_MAP[mimeType] || path.extname(originalFilename) || '.jpg';
  const randomPrefix = crypto.randomBytes(16).toString('hex');
  const filename = `${Date.now()}-${randomPrefix}${ext}`;
  const absolutePath = path.join(uploadDirectory, filename);

  await fs.promises.writeFile(absolutePath, buffer);

  return {
    filename,
    absolutePath,
    url: `/api/v1/storage/${filename}`,
    size: buffer.length,
    mimeType,
  };
}

export function getSafeFilePath(filename: string): string | null {
  ensureUploadDir();
  const sanitized = path.basename(filename);
  const resolved = path.resolve(uploadDirectory, sanitized);
  if (!resolved.startsWith(uploadDirectory)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

export async function deleteFile(filename: string): Promise<boolean> {
  const filePath = getSafeFilePath(filename);
  if (!filePath) return false;

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    logger.error({ filename, err }, 'Failed to delete stored file');
    return false;
  }
}

