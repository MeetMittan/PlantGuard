import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/index.js';
import { AppServerError } from '../errors.js';

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export function sniffSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // WebP: RIFF ... WEBP
  const riff = buffer.toString('ascii', 0, 4) === 'RIFF';
  const webp = buffer.toString('ascii', 8, 12) === 'WEBP';
  if (riff && webp) {
    return true;
  }

  // HEIF / HEIC / AVIF: offset 4 is 'ftyp'
  const ftyp = buffer.toString('ascii', 4, 8) === 'ftyp';
  if (ftyp) {
    return true;
  }

  return false;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024,
    files: 1,
    fields: 10,
  },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (!ACCEPTED_MIME_TYPES.includes(mime as (typeof ACCEPTED_MIME_TYPES)[number])) {
      return cb(
        new AppServerError(
          'INVALID_IMAGE',
          `Unsupported file type '${file.mimetype}'. Only JPEG, PNG, and WebP images are supported.`,
          400,
        ),
      );
    }
    cb(null, true);
  },
});

export const uploadSingleImage = (req: Request, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppServerError(
              'IMAGE_TOO_LARGE',
              `Photo exceeds the ${env.MAX_IMAGE_UPLOAD_MB} MB upload limit.`,
              400,
            ),
          );
        }
        return next(new AppServerError('BAD_REQUEST', `Upload error: ${err.message}`, 400));
      }
      return next(err);
    }

    if (!req.file) {
      return next(new AppServerError('INVALID_IMAGE', 'No image file uploaded. Please provide a photo.', 400));
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return next(new AppServerError('INVALID_IMAGE', 'The uploaded image is empty.', 400));
    }

    if (!sniffSignature(req.file.buffer)) {
      return next(
        new AppServerError(
          'INVALID_IMAGE',
          'The uploaded file does not match a valid image signature.',
          400,
        ),
      );
    }

    next();
  });
};

export const uploadOptionalImage = (req: Request, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppServerError(
              'IMAGE_TOO_LARGE',
              `Photo exceeds the ${env.MAX_IMAGE_UPLOAD_MB} MB upload limit.`,
              400,
            ),
          );
        }
        return next(new AppServerError('BAD_REQUEST', `Upload error: ${err.message}`, 400));
      }
      return next(err);
    }

    if (req.file && (!req.file.buffer || req.file.buffer.length === 0 || !sniffSignature(req.file.buffer))) {
      return next(new AppServerError('INVALID_IMAGE', 'Invalid image data uploaded.', 400));
    }

    next();
  });
};
