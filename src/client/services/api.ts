import type { TorrentDTO, SystemStatusDTO } from '../../shared/types.js';

export async function fetchTorrents(): Promise<TorrentDTO[]> {
  const res = await fetch('/torrents');
  if (!res.ok) throw new Error(`Failed to fetch torrents: HTTP ${res.status}`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatusDTO> {
  const res = await fetch('/system/status');
  if (!res.ok) throw new Error(`Failed to fetch system status: HTTP ${res.status}`);
  return res.json();
}

export async function addTorrent(link: string): Promise<{ infoHash: string }> {
  const res = await fetch('/torrents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Addition failed' }));
    throw new Error(err.message || `Failed to add torrent: HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadTorrents(files: FileList | File[]): Promise<{ infoHash?: string; results?: any[] }> {
  const formData = new FormData();
  Array.from(files).forEach((f) => formData.append('file', f));

  const res = await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(err.message || `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function togglePin(infoHash: string): Promise<{ pinned: boolean }> {
  const res = await fetch(`/torrents/${infoHash}/pin`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to toggle pin: HTTP ${res.status}`);
  return res.json();
}

export async function deleteTorrent(infoHash: string): Promise<void> {
  const res = await fetch(`/torrents/${infoHash}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete torrent: HTTP ${res.status}`);
}

export async function cleanUnpinned(): Promise<{ removedCount: number; keptCount: number }> {
  const res = await fetch('/system/clean', { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to clean unpinned: HTTP ${res.status}`);
  return res.json();
}

export async function fetchTextPreview(
  infoHash: string,
  fileIndexOrPath: string | number
): Promise<{ name: string; content: string }> {
  const res = await fetch(`/torrents/${infoHash}/preview/${fileIndexOrPath}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Preview failed' }));
    throw new Error(err.message || `Failed to preview file: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchFileSha256(
  infoHash: string,
  fileIndexOrPath: string | number
): Promise<{ sha256: string }> {
  const res = await fetch(`/torrents/${infoHash}/hash/${fileIndexOrPath}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Checksum failed' }));
    throw new Error(err.message || `Failed to compute checksum: HTTP ${res.status}`);
  }
  return res.json();
}
