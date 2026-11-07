import iconv from 'iconv-lite';
import crypto from 'node:crypto';
import path from 'node:path';

export class TextPreviewError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'TextPreviewError';
    this.statusCode = statusCode;
  }
}

export function decodeTextFile(buffer: Buffer, fileName: string): string {
  if (buffer.length > 2 * 1024 * 1024) {
    throw new TextPreviewError('File exceeds 2MB preview limit', 413);
  }

  const ext = path.extname(fileName).toLowerCase();

  if (ext === '.nfo' || ext === '.diz') {
    // Check if buffer contains valid UTF-8 without replacement character
    const utf8Attempt = buffer.toString('utf-8');
    const hasReplacement = utf8Attempt.includes('\uFFFD');
    const hasHighAscii = buffer.some((byte) => byte >= 0x80);

    if (hasReplacement || hasHighAscii) {
      // Decode with historical DOS CP437 encoding
      return iconv.decode(buffer, 'cp437');
    }
    return utf8Attempt;
  }

  // Other text files (.txt, .md, .ini, .log, etc.)
  const utf8Text = buffer.toString('utf-8');
  if (utf8Text.includes('\uFFFD')) {
    return iconv.decode(buffer, 'win1252');
  }
  return utf8Text;
}

export async function computeStreamSha256(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
