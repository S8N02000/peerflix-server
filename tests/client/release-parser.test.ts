import { describe, it, expect } from 'vitest';
import { parseReleaseMetadata } from '../../src/client/utils/release-parser.js';

describe('C411 Release Metadata Parser', () => {
  it('should accurately parse The Odyssey 2026 Remux release string and extract all badges', () => {
    const raw = 'The.Odyssey.2026.MULTI.VFQ.2160p.UHD.BluRay.Remux.Custom.DV.HDR10+.DTS-HD.MA.5.1.HEVC-HYPERION.mkv';
    const result = parseReleaseMetadata(raw);

    expect(result.cleanTitle).toBe('The Odyssey');
    expect(result.year).toBe('2026');

    const badgeLabels = result.badges.map((b) => b.label);
    expect(badgeLabels).toContain('MULTI VFQ');
    expect(badgeLabels).toContain('2160p');
    expect(badgeLabels).toContain('Remux');
    expect(badgeLabels).toContain('DV HDR10+');
    expect(badgeLabels).toContain('DTS-HD MA 5.1');
    expect(badgeLabels).toContain('HEVC');
    expect(badgeLabels).toContain('HYPERION');
  });

  it('should parse 1080p Web-DL TrueFrench release cleanly', () => {
    const raw = 'Arcane.S02E01.TRUEFRENCH.1080p.WEB-DL.DDP5.1.H.264-FRATERNiTY.mkv';
    const result = parseReleaseMetadata(raw);

    expect(result.cleanTitle).toBe('Arcane S02E01');
    const badgeLabels = result.badges.map((b) => b.label);
    expect(badgeLabels).toContain('TRUEFRENCH');
    expect(badgeLabels).toContain('1080p');
    expect(badgeLabels).toContain('WEB-DL');
    expect(badgeLabels).toContain('H.264');
    expect(badgeLabels).toContain('FRATERNiTY');
  });
});
