import fsSync from 'node:fs';
import path from 'node:path';
import type { FileCategory } from '../../../shared/types.js';
import { resolveSafeFilePath } from '../../utils/path-security.js';
import type { TorrentStore } from '../../services/store.js';

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

export function resolvePlayableFile(store: TorrentStore, infoHash: string, fileParam: string): any {
  const engine = store.get(infoHash);

  // 1. If engine is ready and files are available, use engine file
  if (engine && engine.ready && engine.files) {
    const file = findTorrentFile(engine, fileParam);
    if (file) return file;
  }

  // 2. Fallback: Check metadata cache and disk if engine is not ready or file not found
  const meta = store.getMetadata(infoHash);
  if (meta?.files && Array.isArray(meta.files)) {
    let cachedFile: any = null;
    if (/^\d+$/.test(fileParam)) {
      const idx = parseInt(fileParam, 10);
      cachedFile = meta.files.find((f: any) => f.index === idx) || meta.files[idx];
    } else {
      cachedFile = meta.files.find(
        (f: any) => f.path === fileParam || f.name === fileParam || (f.path && f.path.endsWith(fileParam))
      );
    }

    if (cachedFile) {
      try {
        const downloadBase = path.join(store.getDownloadPath(), infoHash);
        const resolvedPath = resolveSafeFilePath(downloadBase, cachedFile.path);
        if (fsSync.existsSync(resolvedPath)) {
          const stat = fsSync.statSync(resolvedPath);
          if (stat.size > 0) {
            return {
              name: cachedFile.name,
              path: cachedFile.path,
              length: cachedFile.length || stat.size,
              index: cachedFile.index,
              isDiskFallback: true,
              diskPath: resolvedPath,
              createReadStream: (opts?: { start?: number; end?: number }) => {
                return fsSync.createReadStream(resolvedPath, opts);
              }
            };
          }
        }
      } catch {
        // Safe path resolution failed or file unreadable on disk
      }
    }
  }

  return null;
}

