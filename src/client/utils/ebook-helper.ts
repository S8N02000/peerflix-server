export type EbookFormat = 'epub' | 'pdf' | 'comic' | 'other';
export type ReaderTheme = 'dark' | 'sepia' | 'light';
export type ComicReadingMode = 'webtoon' | 'single' | 'double';

const EBOOK_EXTENSIONS: Record<string, EbookFormat> = {
  '.epub': 'epub',
  '.pdf': 'pdf',
  '.cbz': 'comic',
  '.cbr': 'comic',
  '.mobi': 'epub',
  '.azw3': 'epub',
  '.fb2': 'epub',
  '.djvu': 'pdf',
};

export function isEbookFile(filePathOrName: string): boolean {
  if (!filePathOrName) return false;
  const ext = getFileExtension(filePathOrName);
  return Boolean(EBOOK_EXTENSIONS[ext]);
}

export function getEbookFormat(filePathOrName: string): EbookFormat {
  if (!filePathOrName) return 'other';
  const ext = getFileExtension(filePathOrName);
  return EBOOK_EXTENSIONS[ext] || 'other';
}

function getFileExtension(pathStr: string): string {
  const match = pathStr.match(/\.[0-9a-z]+$/i);
  return match ? match[0].toLowerCase() : '';
}

// Position persistence
export function getSavedEbookPosition(infoHash: string, fileIndex: number): string | null {
  try {
    return localStorage.getItem(`peerflix_ebook_pos_${infoHash}_${fileIndex}`);
  } catch {
    return null;
  }
}

export function saveEbookPosition(infoHash: string, fileIndex: number, position: string): void {
  try {
    localStorage.setItem(`peerflix_ebook_pos_${infoHash}_${fileIndex}`, position);
  } catch {
    // Ignore localStorage errors
  }
}

// Reader preferences persistence
export interface ReaderPreferences {
  theme: ReaderTheme;
  fontSize: number; // in px, e.g. 18
  fontFamily: 'serif' | 'sans-serif' | 'monospace';
  comicMode: ComicReadingMode;
}

const DEFAULT_PREFERENCES: ReaderPreferences = {
  theme: 'dark',
  fontSize: 18,
  fontFamily: 'serif',
  comicMode: 'single',
};

const PREFS_STORAGE_KEY = 'peerflix_reader_preferences';

export function getReaderPreferences(): ReaderPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback
  }
  return { ...DEFAULT_PREFERENCES };
}

export function saveReaderPreferences(prefs: Partial<ReaderPreferences>): void {
  try {
    const current = getReaderPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}
