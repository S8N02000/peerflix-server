import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import type {
  MediaProbeDTO,
  VideoStreamDTO,
  AudioStreamDTO,
  SubtitleStreamDTO
} from '../../shared/types.js';

const BROWSER_SUPPORTED_VIDEO_CODECS = new Set(['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1']);
const BROWSER_SUPPORTED_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm']);
const TEXT_BASED_SUBTITLE_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt']);

export const mediaProbeCache = new Map<string, MediaProbeDTO>();

export function parseFfprobeOutput(parsed: any): MediaProbeDTO {
  const streams: any[] = parsed?.streams || [];

  const videoStreams: VideoStreamDTO[] = [];
  const audioStreams: AudioStreamDTO[] = [];
  const subtitleStreams: SubtitleStreamDTO[] = [];

  let audioTrackIndex = 0;
  let subTrackIndex = 0;

  for (const stream of streams) {
    const codec = (stream.codec_name || '').toLowerCase();
    const codecType = stream.codec_type;

    if (codecType === 'video') {
      videoStreams.push({
        index: stream.index,
        codec,
        width: stream.width,
        height: stream.height,
        browserSupported: BROWSER_SUPPORTED_VIDEO_CODECS.has(codec)
      });
    } else if (codecType === 'audio') {
      const isSupported = BROWSER_SUPPORTED_AUDIO_CODECS.has(codec);
      const tags = stream.tags || {};
      const language = tags.language || tags.lang;
      const title = tags.title;

      audioStreams.push({
        index: stream.index,
        audioTrackIndex: audioTrackIndex++,
        codec,
        channels: stream.channels || 2,
        language,
        title,
        browserSupported: isSupported
      });
    } else if (codecType === 'subtitle') {
      const isText = TEXT_BASED_SUBTITLE_CODECS.has(codec);
      const tags = stream.tags || {};
      const language = tags.language || tags.lang;
      const title = tags.title;

      subtitleStreams.push({
        index: stream.index,
        subTrackIndex: subTrackIndex++,
        codec,
        language,
        title,
        isTextBased: isText
      });
    }
  }

  // Extract duration from format.duration or stream tags
  let durationSeconds: number | undefined;
  if (parsed?.format?.duration) {
    const parsedDur = parseFloat(parsed.format.duration);
    if (!isNaN(parsedDur) && parsedDur > 0) {
      durationSeconds = Math.round(parsedDur * 10) / 10;
    }
  }

  // needsAudioRemux is true if the default/first audio track is not supported, or if multiple audio tracks exist
  const firstAudio = audioStreams[0];
  const needsAudioRemux =
    audioStreams.length > 1 || (firstAudio !== undefined && !firstAudio.browserSupported);

  return {
    durationSeconds,
    videoStreams,
    audioStreams,
    subtitleStreams,
    needsAudioRemux
  };
}

export async function probeMediaStream(
  inputStream: Readable,
  timeoutMs = 8000
): Promise<MediaProbeDTO> {
  return new Promise<MediaProbeDTO>((resolve, reject) => {
    let resolved = false;

    const ffprobe = spawn(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', 'pipe:0'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    let stdoutData = '';
    let stderrData = '';

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          ffprobe.kill('SIGKILL');
        } catch {
          // Ignore
        }
        reject(new Error(`ffprobe probe timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    ffprobe.stdout.on('data', (chunk: Buffer) => {
      stdoutData += chunk.toString();
    });

    ffprobe.stderr.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString();
    });

    ffprobe.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    ffprobe.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        if (code !== 0 && !stdoutData) {
          reject(new Error(`ffprobe exited with code ${code}: ${stderrData}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData);
          resolve(parseFfprobeOutput(parsed));
        } catch (err: any) {
          reject(new Error(`Failed to parse ffprobe json: ${err.message}`));
        }
      }
    });

    // Pipe initial bytes to ffprobe
    inputStream.pipe(ffprobe.stdin);

    inputStream.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try {
          ffprobe.kill('SIGKILL');
        } catch {
          // Ignore
        }
        reject(err);
      }
    });
  });
}
