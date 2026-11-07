import { describe, it, expect, vi } from 'vitest';
import { parseArgs } from '../../src/server/bin.js';

describe('CLI Argument Parser (bin.ts)', () => {
  it('parses default options', () => {
    const opts = parseArgs([]);
    expect(opts.port).toBe(9000);
    expect(opts.configPath).toBeUndefined();
    expect(opts.downloadPath).toBeUndefined();
  });

  it('parses --port, --config, --path arguments', () => {
    const argv = ['--port', '8080', '--config', '/tmp/my-config', '--path', '/tmp/my-downloads'];
    const opts = parseArgs(argv);
    expect(opts.port).toBe(8080);
    expect(opts.configPath).toBe('/tmp/my-config');
    expect(opts.downloadPath).toBe('/tmp/my-downloads');
  });

  it('parses short flags -p, -c, -d', () => {
    const argv = ['-p', '3000', '-c', '/var/lib/peerflix', '-d', '/mnt/torrents'];
    const opts = parseArgs(argv);
    expect(opts.port).toBe(3000);
    expect(opts.configPath).toBe('/var/lib/peerflix');
    expect(opts.downloadPath).toBe('/mnt/torrents');
  });
});
