import { Router, type Request, type Response } from 'express';
import { getSafeFilePath } from '../../storage/index.js';
import { AppServerError } from '../../errors.js';

const router = Router();

router.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const safePath = getSafeFilePath(filename);

  if (!safePath) {
    throw AppServerError.notFound('Requested file does not exist');
  }

  res.sendFile(safePath);
});

export const storageRouter = router;

