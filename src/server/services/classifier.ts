import path from 'node:path';
import type { FileCategory, TorrentCategory } from '../../shared/types.js';

const EXTENSIONS: Record<FileCategory, string[]> = {
  video: ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv', '.flv', '.ts', '.m2ts'],
  audio: ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.opus', '.wma', '.alac', '.aiff'],
  subtitle: ['.srt', '.vtt', '.ass', '.sub', '.idx', '.smi'],
  executable: ['.exe', '.msi', '.dmg', '.pkg', '.apk', '.nsp', '.xci', '.bin', '.appimage', '.deb', '.rpm', '.dll'],
  disc_image: ['.iso', '.img', '.cue', '.mds', '.nrg'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz'],
  document: ['.pdf', '.epub', '.cbz', '.cbr', '.mobi', '.doc', '.docx'],
  info: ['.nfo', '.txt', '.md', '.diz', '.log', '.ini'],
  other: []
};

export function classifyFile(filePathOrName: string): FileCategory {
  const ext = path.extname(filePathOrName).toLowerCase();
  for (const [category, extList] of Object.entries(EXTENSIONS)) {
    if (extList.includes(ext)) {
      return category as FileCategory;
    }
  }
  return 'other';
}

export function isSampleFile(fileName: string, length: number): boolean {
  const lower = fileName.toLowerCase();
  const isVideo = classifyFile(fileName) === 'video';
  const hasSampleKeyword = lower.includes('sample') || lower.includes('-sample');
  // Sample video if under 100 MB
  return isVideo && hasSampleKeyword && length < 100 * 1024 * 1024;
}

export function classifyTorrent(
  files: Array<{ name: string; path?: string; length: number }>
): TorrentCategory {
  if (!files || files.length === 0) {
    return 'other';
  }

  let totalBytes = 0;
  let videoBytes = 0;
  let audioBytes = 0;
  let archiveBytes = 0;
  let documentBytes = 0;
  let hasGameOrAppFile = false;

  for (const file of files) {
    const filePath = file.path || file.name;
    const cat = classifyFile(filePath);
    const len = file.length || 0;
    totalBytes += len;

    if (cat === 'executable' || cat === 'disc_image') {
      hasGameOrAppFile = true;
    } else if (cat === 'video') {
      videoBytes += len;
    } else if (cat === 'audio') {
      audioBytes += len;
    } else if (cat === 'archive') {
      archiveBytes += len;
    } else if (cat === 'document') {
      documentBytes += len;
    }
  }

  if (hasGameOrAppFile) {
    return 'game_app';
  }

  if (totalBytes > 0 && videoBytes / totalBytes >= 0.6) {
    return 'video';
  }

  if (audioBytes > videoBytes && audioBytes > archiveBytes && audioBytes > documentBytes) {
    return 'audio';
  }

  if (archiveBytes > videoBytes && archiveBytes > audioBytes && archiveBytes > documentBytes) {
    return 'archive';
  }

  if (documentBytes > 0.5 * totalBytes) {
    return 'document';
  }

  if (videoBytes > 0) {
    return 'video';
  }

  return 'other';
}

export function shouldSelectFile(
  torrentCategory: TorrentCategory,
  file: { name: string; path?: string; length: number }
): boolean {
  if (torrentCategory !== 'video') {
    // For games, apps, audio albums, archives, documents: select ALL files
    return true;
  }

  const filePath = file.path || file.name;
  const category = classifyFile(filePath);

  if (category === 'subtitle' || category === 'info') {
    return true;
  }

  if (category === 'video') {
    if (isSampleFile(file.name, file.length)) {
      return false;
    }
    return true;
  }

  return false;
}
