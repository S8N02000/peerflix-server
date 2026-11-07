import iconv from 'iconv-lite';

export function decodeSubtitleBuffer(buffer: Buffer): string {
  // Check if buffer contains BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf-8');
  }

  // Attempt UTF-8 decode
  const utf8Text = buffer.toString('utf-8');

  // If replacement character (\uFFFD) is found, it's likely Windows-1252 / ISO-8859-1
  if (utf8Text.includes('\uFFFD')) {
    return iconv.decode(buffer, 'win1252');
  }

  return utf8Text;
}

export function srtToVtt(buffer: Buffer | string): string {
  const rawText = Buffer.isBuffer(buffer) ? decodeSubtitleBuffer(buffer) : buffer;

  // Clean BOM and normalize line endings
  let normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // If already WebVTT, return it cleaned
  if (normalized.trimStart().startsWith('WEBVTT')) {
    return normalized;
  }

  // Convert SRT comma millisecond separators to VTT dots: 00:01:20,500 --> 00:01:23,000
  normalized = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );

  return `WEBVTT\n\n${normalized.trim()}\n`;
}
