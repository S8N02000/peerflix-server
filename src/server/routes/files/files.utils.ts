import type { FileCategory } from '../../../shared/types.js';

export const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.aac': 'audio/aac',
  '.srt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.nfo': 'text/plain; charset=cp437',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export const ALWAYS_ATTACHMENT_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.svg',
  '.js',
  '.mjs',
  '.wasm',
  '.exe',
  '.msi',
  '.dmg',
  '.iso',
  '.zip',
  '.rar',
  '.7z',
  '.bin',
  '.tar',
  '.gz',
  '.apk',
  '.nsp',
  '.xci',
]);

export function encodeContentDisposition(fileName: string, asAttachment: boolean): string {
  const type = asAttachment ? 'attachment' : 'inline';
  const cleanAscii = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const encodedUtf8 = encodeURIComponent(fileName);
  return `${type}; filename="${cleanAscii}"; filename*=UTF-8''${encodedUtf8}`;
}

export function findTorrentFile(engine: any, fileParam: string): any {
  if (!engine || !engine.files) return null;
  if (/^\d+$/.test(fileParam)) {
    const idx = parseInt(fileParam, 10);
    if (idx >= 0 && idx < engine.files.length) {
      return engine.files[idx];
    }
  }
  return engine.files.find(
    (f: any) => f.path === fileParam || f.name === fileParam || (f.path && f.path.endsWith(fileParam))
  );
}
