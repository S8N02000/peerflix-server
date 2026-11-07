import type { Request, Response, NextFunction } from 'express';
import { SecurityError } from '../utils/path-security.js';
import { TorrentParserError } from '../services/torrent-parser.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode =
    typeof err.status === 'number'
      ? err.status
      : typeof err.statusCode === 'number'
      ? err.statusCode
      : err instanceof SecurityError
      ? 403
      : err instanceof TorrentParserError
      ? 400
      : err.code === 'LIMIT_FILE_SIZE'
      ? 413
      : 500;

  if (statusCode >= 500) {
    console.error(`[Error] Internal Server Error on ${req.method} ${req.path}:`, err);
  }

  res.status(statusCode).json({
    error: err.name || (statusCode >= 500 ? 'InternalServerError' : 'BadRequest'),
    message: statusCode >= 500 ? 'An internal error occurred on the server' : err.message || 'Request failed'
  });
}
