import { describe, it, expect } from 'vitest';
import iconv from 'iconv-lite';
import { srtToVtt } from '../../src/server/utils/srt-to-vtt.js';

describe('SRT to WebVTT converter utility', () => {
  const sampleSrt = `1
00:01:20,500 --> 00:01:23,000
Bonjour à tous ! Ça va être génial.

2
00:01:24,100 --> 00:01:26,800
Un été inoubliable avec des crêpes et du thé.
`;

  it('should convert UTF-8 SRT with French accents into valid WebVTT', () => {
    const srtBuffer = Buffer.from(sampleSrt, 'utf-8');
    const vtt = srtToVtt(srtBuffer);

    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:01:20.500 --> 00:01:23.000');
    expect(vtt).toContain('00:01:24.100 --> 00:01:26.800');
    expect(vtt).toContain('Bonjour à tous ! Ça va être génial.');
    expect(vtt).toContain('Un été inoubliable avec des crêpes et du thé.');
  });

  it('should convert Windows-1252 / CP1252 encoded French SRT into valid WebVTT', () => {
    const cp1252Buffer = iconv.encode(sampleSrt, 'win1252');
    const vtt = srtToVtt(cp1252Buffer);

    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:01:20.500 --> 00:01:23.000');
    expect(vtt).toContain('Bonjour à tous ! Ça va être génial.');
    expect(vtt).toContain('Un été inoubliable avec des crêpes et du thé.');
  });

  it('should preserve already valid WebVTT content', () => {
    const alreadyVtt = `WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello World\n`;
    const result = srtToVtt(alreadyVtt);

    expect(result.startsWith('WEBVTT')).toBe(true);
    expect(result).toContain('00:00:01.000 --> 00:00:05.000');
  });
});
