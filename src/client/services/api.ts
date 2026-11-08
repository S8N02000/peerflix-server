import type { TorrentDTO, SystemStatusDTO } from '../../shared/types.js';
import { getCurrentUser, getIsAdmin, getSavedAdminToken } from '../utils/auth-url.js';

function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set('X-Peerflix-User', getCurrentUser());
  if (getIsAdmin()) {
    headers.set('X-Peerflix-Admin', 'true');
    const token = getSavedAdminToken();
    if (token) {
      headers.set('X-Peerflix-Admin-Token', token);
    }
  }

  return fetch(input, {
    credentials: 'include',
    ...init,
    headers
  });
}

export async function verifyAdminPassword(password: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch('/system/admin-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Mot de passe administrateur incorrect' }));
    throw new Error(err.message || 'Mot de passe administrateur incorrect');
  }
  return res.json();
}

export async function fetchTorrents(): Promise<TorrentDTO[]> {
  const res = await authFetch('/torrents');
  if (!res.ok) throw new Error(`Failed to fetch torrents: HTTP ${res.status}`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatusDTO> {
  const res = await authFetch('/system/status');
  if (!res.ok) throw new Error(`Failed to fetch system status: HTTP ${res.status}`);
  return res.json();
}

export async function addTorrent(
  link: string,
  options?: { isPrivate?: boolean; addedBy?: string }
): Promise<{ infoHash: string }> {
  const res = await authFetch('/torrents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      link,
      addedBy: options?.addedBy || getCurrentUser(),
      isPrivate: Boolean(options?.isPrivate)
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Addition failed' }));
    throw new Error(err.message || `Failed to add torrent: HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadTorrents(
  files: FileList | File[],
  options?: { isPrivate?: boolean; addedBy?: string }
): Promise<{ infoHash?: string; results?: any[] }> {
  const formData = new FormData();
  Array.from(files).forEach((f) => formData.append('file', f));
  formData.append('addedBy', options?.addedBy || getCurrentUser());
  if (options?.isPrivate) {
    formData.append('isPrivate', 'true');
  }

  const res = await authFetch('/upload', {
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
  const res = await authFetch(`/torrents/${infoHash}/pin`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to toggle pin: HTTP ${res.status}`);
  return res.json();
}

export async function toggleTorrentVisibility(infoHash: string, isPrivate: boolean): Promise<{ isPrivate: boolean }> {
  const res = await authFetch(`/torrents/${infoHash}/visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPrivate })
  });
  if (!res.ok) throw new Error(`Failed to update visibility: HTTP ${res.status}`);
  return res.json();
}

export async function deleteTorrent(infoHash: string): Promise<void> {
  const res = await authFetch(`/torrents/${infoHash}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete torrent: HTTP ${res.status}`);
}

export async function cleanUnpinned(): Promise<{ removedCount: number; keptCount: number }> {
  const res = await authFetch('/system/clean', { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to clean unpinned: HTTP ${res.status}`);
  return res.json();
}

export async function fetchTextPreview(
  infoHash: string,
  fileIndexOrPath: string | number
): Promise<{ name: string; content: string }> {
  const res = await authFetch(`/torrents/${infoHash}/preview/${fileIndexOrPath}`);
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
  const res = await authFetch(`/torrents/${infoHash}/hash/${fileIndexOrPath}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Checksum failed' }));
    throw new Error(err.message || `Failed to compute checksum: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchC411Status(): Promise<import('../../shared/types.js').C411ProfileDTO> {
  const res = await authFetch('/c411/status');
  if (!res.ok) throw new Error(`Failed to fetch C411 status: HTTP ${res.status}`);
  return res.json();
}

export async function searchC411(
  query = '',
  cat = ''
): Promise<{ results: import('../../shared/types.js').C411SearchResultDTO[] }> {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (cat) params.set('cat', cat);
  const res = await authFetch(`/c411/search?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Search failed' }));
    throw new Error(err.message || `Search failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function addC411Torrent(
  id: string,
  options?: { isPrivate?: boolean; addedBy?: string }
): Promise<{ infoHash: string }> {
  const res = await authFetch('/c411/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      addedBy: options?.addedBy || getCurrentUser(),
      isPrivate: Boolean(options?.isPrivate)
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Add torrent failed' }));
    throw new Error(err.message || `Add failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchC411Details(id: string): Promise<import('../../shared/types.js').C411TorrentDetailsDTO> {
  const res = await authFetch(`/c411/details/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch torrent details' }));
    throw new Error(err.message || `Failed to fetch details: HTTP ${res.status}`);
  }
  return res.json();
}

