import { describe, it, expect } from 'vitest';
import iconv from 'iconv-lite';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import {
  decodeTextFile,
  computeStreamSha256,
  TextPreviewError
} from '../../src/server/utils/text-preview.js';

describe('Text preview and SHA-256 utility', () => {
  it('should decode CP437 ASCII Art box-drawing characters (╔═══╗) into UTF-8', () => {
    const rawBoxString = '╔═══╗\n║NFO║\n╚═══╝';
    const cp437Buffer = iconv.encode(rawBoxString, 'cp437');

    const decoded = decodeTextFile(cp437Buffer, 'release.nfo');

    expect(decoded).toContain('╔═══╗');
    expect(decoded).toContain('║NFO║');
    expect(decoded).toContain('╚═══╝');
  });

  it('should reject text preview if file exceeds 2MB limit with 413 error', () => {
    const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 10); // > 2MB

    expect(() => decodeTextFile(largeBuffer, 'large_log.txt')).toThrowError(TextPreviewError);
    try {
      decodeTextFile(largeBuffer, 'large_log.txt');
    } catch (err: any) {
      expect(err.statusCode).toBe(413);
    }
  });

  it('should compute valid SHA-256 hash from a stream', async () => {
    const testData = 'Peerflix SHA256 integrity check stream test';
    const expectedHash = crypto.createHash('sha256').update(testData).digest('hex');

    const stream = Readable.from([Buffer.from(testData)]);
    const computedHash = await computeStreamSha256(stream);

    expect(computedHash).toBe(expectedHash);
    expect(computedHash).toHaveLength(64);
  });
});
