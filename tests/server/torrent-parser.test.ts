import { describe, it, expect } from 'vitest';
import { parseTorrentInput, SecurityError, TorrentParserError } from '../../src/server/services/torrent-parser.js';

describe('Torrent parser service', () => {
  const validHexHash = '0123456789abcdef0123456789abcdef01234567';
  const validMagnet = `magnet:?xt=urn:btih:${validHexHash}&dn=TestFile`;

  it('should accept a 40-character hexadecimal infoHash', async () => {
    const result = await parseTorrentInput(validHexHash);
    expect(result.parsed.infoHash).toBe(validHexHash);
    expect(typeof result.source).toBe('string');
  });

  it('should accept a valid magnet link', async () => {
    const result = await parseTorrentInput(validMagnet);
    expect(result.parsed.infoHash).toBe(validHexHash);
    expect(result.source).toBe(validMagnet);
  });

  it('should reject local file paths with a SecurityError', async () => {
    const localPaths = [
      '/etc/passwd',
      'file:///etc/passwd',
      'C:\\Windows\\win.ini',
      'C:/Windows/win.ini',
      '../../secret.torrent',
      './local.torrent'
    ];

    for (const p of localPaths) {
      await expect(parseTorrentInput(p)).rejects.toThrowError(SecurityError);
    }
  });

  it('should reject loopback and private IP addresses (SSRF Protection)', async () => {
    const privateUrls = [
      'http://127.0.0.1:8080/test.torrent',
      'http://localhost:3000/test.torrent',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/torrent.torrent',
      'http://192.168.1.1/test.torrent',
      'http://172.16.5.10/test.torrent',
      'http://[::1]:9000/test.torrent'
    ];

    for (const url of privateUrls) {
      await expect(parseTorrentInput(url)).rejects.toThrowError(SecurityError);
    }
  });

  it('should reject invalid and empty inputs', async () => {
    await expect(parseTorrentInput('')).rejects.toThrowError(TorrentParserError);
    await expect(parseTorrentInput('not-a-valid-input-at-all')).rejects.toThrowError(TorrentParserError);
  });
});
