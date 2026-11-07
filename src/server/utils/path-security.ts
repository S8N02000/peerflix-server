import path from 'node:path';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export function sanitizeRelativePath(rawPath: string): string {
  if (typeof rawPath !== 'string') {
    throw new SecurityError('Path must be a string');
  }

  // Reject null bytes, carriage returns, and newlines
  if (rawPath.includes('\0') || rawPath.includes('\r') || rawPath.includes('\n')) {
    throw new SecurityError('Malicious characters detected in path (null byte or newline)');
  }

  // Reject absolute paths
  if (path.isAbsolute(rawPath) || rawPath.startsWith('/') || rawPath.startsWith('\\') || /^[a-zA-Z]:/.test(rawPath)) {
    throw new SecurityError('Absolute paths are prohibited');
  }

  // Normalize backslashes to forward slashes
  const normalized = rawPath.replace(/\\/g, '/');

  // Split into components and filter out malicious traversal segments
  const segments = normalized.split('/').filter(Boolean);
  const safeSegments: string[] = [];

  for (const segment of segments) {
    if (segment === '.' || segment === '') {
      continue;
    }
    if (segment === '..') {
      if (safeSegments.length === 0) {
        throw new SecurityError('Path traversal detected: attempted access above root directory');
      }
      safeSegments.pop();
    } else {
      safeSegments.push(segment);
    }
  }

  return safeSegments.join('/');
}

export function resolveSafeFilePath(baseDir: string, relativeFilePath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const sanitized = sanitizeRelativePath(relativeFilePath);

  if (!sanitized) {
    throw new SecurityError('Empty or invalid file path after sanitization');
  }

  const resolvedFull = path.resolve(resolvedBase, sanitized);
  const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;

  if (!resolvedFull.startsWith(baseWithSep)) {
    throw new SecurityError(
      `Path traversal detected: path '${resolvedFull}' escaped base directory '${resolvedBase}'`
    );
  }

  return resolvedFull;
}
