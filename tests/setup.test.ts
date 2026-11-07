import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Environment cleanup verification (Legacy files purge)', () => {
  const legacyFiles = [
    'bower.json',
    '.bowerrc',
    'Gruntfile.js',
    'karma.conf.js',
    '.travis.yml',
    '.jshintrc',
    'server/.jshintrc',
    'test/.jshintrc',
    'server/ffmpeg.js',
    'server',
    'app',
    'test'
  ];

  legacyFiles.forEach((file) => {
    it(`should not have legacy file/dir: ${file}`, () => {
      const fullPath = path.resolve(process.cwd(), file);
      expect(fs.existsSync(fullPath)).toBe(false);
    });
  });

  it('should have preserved logo.svg in src/client/assets/logo.svg', () => {
    const logoPath = path.resolve(process.cwd(), 'src/client/assets/logo.svg');
    expect(fs.existsSync(logoPath)).toBe(true);
  });

  it('should verify that package.json bin points to dist/server/server/bin.js and exists after build', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.bin['peerflix-server']).toBe('./dist/server/server/bin.js');
    expect(pkg.scripts.start).toBe('node dist/server/server/bin.js');
    const binPath = path.resolve(process.cwd(), 'dist/server/server/bin.js');
    expect(fs.existsSync(binPath)).toBe(true);
  });
});
