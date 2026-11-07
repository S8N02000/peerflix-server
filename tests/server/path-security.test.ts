import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  sanitizeRelativePath,
  resolveSafeFilePath,
  SecurityError
} from '../../src/server/utils/path-security.js';

describe('Path Traversal Security Utility', () => {
  const baseDir = '/tmp/torrent-stream';

  it('should allow and properly resolve legitimate file paths', () => {
    const normalPaths = ['Dune/Dune.mkv', 'Game/Crack/fix.exe', 'music/album/track01.flac'];

    for (const p of normalPaths) {
      const sanitized = sanitizeRelativePath(p);
      expect(sanitized).toBe(p.replace(/\\/g, '/'));

      const safePath = resolveSafeFilePath(baseDir, p);
      expect(safePath).toBe(path.resolve(baseDir, p));
    }
  });

  it('should reject path traversal attacks with SecurityError', () => {
    const maliciousPaths = [
      '../../../etc/passwd',
      'folder/../../secret',
      '/etc/shadow',
      'C:\\Windows\\System32',
      '..\\..\\Windows\\System32'
    ];

    for (const badPath of maliciousPaths) {
      expect(() => resolveSafeFilePath(baseDir, badPath)).toThrowError(SecurityError);
    }
  });

  it('should reject paths containing null bytes or CRLF characters', () => {
    const dangerousChars = [
      'evil.txt\0.png',
      'evil.txt\r\nmalicious',
      'folder/\nsecret.txt',
      'file\0'
    ];

    for (const p of dangerousChars) {
      expect(() => sanitizeRelativePath(p)).toThrowError(SecurityError);
      expect(() => resolveSafeFilePath(baseDir, p)).toThrowError(SecurityError);
    }
  });
});
