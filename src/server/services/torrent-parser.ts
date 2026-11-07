import parseTorrent, { Instance as ParseTorrentResult } from 'parse-torrent';
import dns from 'node:dns/promises';
import net from 'node:net';

export class TorrentParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TorrentParserError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return false;
  }

  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') {
    return true;
  }

  // IPv4 Private subnets
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link Local / Cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
  }

  // IPv6 Link-local / Unique Local Address
  const lower = ip.toLowerCase();
  if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
    return true;
  }

  return false;
}

export async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new TorrentParserError('Invalid URL format');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SecurityError(`Forbidden protocol: ${parsedUrl.protocol}`);
  }

  const rawHostname = parsedUrl.hostname.toLowerCase();
  const hostname = rawHostname.replace(/^\[|\]$/g, '');

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    throw new SecurityError('Localhost and loopback addresses are strictly prohibited (Anti-SSRF)');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SecurityError(`Access to private IP address is prohibited: ${hostname} (Anti-SSRF)`);
    }
  } else {
    try {
      const lookupResults = await dns.lookup(hostname, { all: true });
      for (const res of lookupResults) {
        if (isPrivateIp(res.address)) {
          throw new SecurityError(
            `Domain resolves to private/internal IP (${res.address}): access prohibited (Anti-SSRF)`
          );
        }
      }
    } catch (err: any) {
      if (err instanceof SecurityError) throw err;
      throw new TorrentParserError(`DNS lookup failed for host ${hostname}: ${err.message}`);
    }
  }

  return parsedUrl;
}

export async function parseTorrentInput(
  input: string | Buffer
): Promise<{ parsed: ParseTorrentResult; source: string | Buffer }> {
  if (Buffer.isBuffer(input)) {
    try {
      const parsed = await parseTorrent(input);
      if (!parsed || !parsed.infoHash) {
        throw new TorrentParserError('Failed to parse torrent buffer: missing infoHash');
      }
      return { parsed, source: input };
    } catch (err: any) {
      throw new TorrentParserError(`Invalid .torrent buffer: ${err.message}`);
    }
  }

  if (typeof input !== 'string' || !input.trim()) {
    throw new TorrentParserError('Torrent input must be a non-empty string or Buffer');
  }

  const trimmed = input.trim();

  // Local file path rejection (Strict Security)
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('file://') ||
    /^[a-zA-Z]:[/\\]/.test(trimmed) ||
    trimmed.includes('/etc/') ||
    trimmed.includes('\\Windows\\') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    throw new SecurityError('Local file paths are strictly prohibited');
  }

  // 40 chars Hex infoHash or 32 chars Base32 infoHash
  const hexHashRegex = /^[0-9a-fA-F]{40}$/;
  const b32HashRegex = /^[2-7a-zA-Z]{32}$/;

  if (hexHashRegex.test(trimmed) || b32HashRegex.test(trimmed)) {
    const magnetUri = `magnet:?xt=urn:btih:${trimmed}`;
    const parsed = await parseTorrent(magnetUri);
    return { parsed, source: magnetUri };
  }

  // Magnet link
  if (trimmed.startsWith('magnet:?')) {
    try {
      const parsed = await parseTorrent(trimmed);
      if (!parsed || !parsed.infoHash) {
        throw new TorrentParserError('Invalid magnet link: missing infoHash');
      }
      return { parsed, source: trimmed };
    } catch (err: any) {
      throw new TorrentParserError(`Invalid magnet link: ${err.message}`);
    }
  }

  // HTTP or HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const validatedUrl = await validatePublicUrl(trimmed);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(validatedUrl.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'Peerflix-Server/1.0' }
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new TorrentParserError(`Failed to fetch torrent: HTTP ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = await parseTorrent(buffer);
      if (!parsed || !parsed.infoHash) {
        throw new TorrentParserError('Downloaded file is not a valid torrent');
      }
      return { parsed, source: buffer };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err instanceof SecurityError || err instanceof TorrentParserError) throw err;
      throw new TorrentParserError(`Failed to download torrent from URL: ${err.message}`);
    }
  }

  throw new TorrentParserError('Unsupported torrent format (must be infoHash, magnet link, or .torrent buffer)');
}
