import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { getOpenAIClient } from './client';
import type { TranscriptSegment } from '../types';

const execAsync = promisify(exec);

const APP_MAX_FILE_SIZE_MB = 500;
const APP_MAX_FILE_SIZE = APP_MAX_FILE_SIZE_MB * 1024 * 1024;
const WHISPER_MAX_FILE_SIZE_MB = 25;
const WHISPER_MAX_FILE_SIZE = WHISPER_MAX_FILE_SIZE_MB * 1024 * 1024;
const CHUNK_SAFETY_RATIO = 0.9;
const MIN_CHUNK_SECONDS = 30;
const MAX_SPLIT_ATTEMPTS = 3;

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperResponse {
  text: string;
  segments?: WhisperSegment[];
}

export async function transcribeAudio(filePath: string): Promise<TranscriptSegment[]> {
  const openai = getOpenAIClient();

  // Enforce app-level limit before chunking
  const stats = fs.statSync(filePath);
  if (stats.size > APP_MAX_FILE_SIZE) {
    throw new Error(
      `Audio file is too large (${Math.round(stats.size / 1024 / 1024)}MB). ` +
      `Maximum size is ${APP_MAX_FILE_SIZE_MB}MB. Try a shorter video.`
    );
  }

  if (stats.size <= WHISPER_MAX_FILE_SIZE) {
    return transcribeSingle(openai, filePath, 0);
  }

  const { chunkPaths, cleanup } = await splitAudioForWhisper(filePath);

  try {
    const allSegments: TranscriptSegment[] = [];
    let offsetSeconds = 0;

    for (const chunkPath of chunkPaths) {
      const segments = await transcribeSingle(openai, chunkPath, offsetSeconds);
      allSegments.push(...segments);
      const chunkDuration = await getAudioDurationSeconds(chunkPath);
      offsetSeconds += chunkDuration;
    }

    return allSegments;
  } finally {
    cleanup();
  }
}

// Estimate transcription cost based on audio duration
export function estimateTranscriptionCost(durationSeconds: number): string {
  // Whisper costs $0.006 per minute
  const minutes = durationSeconds / 60;
  const cost = minutes * 0.006;
  return `~$${cost.toFixed(2)}`;
}

// Check if audio file is within size limits
export function checkAudioFileSize(filePath: string): {
  valid: boolean;
  sizeMB: number;
  error?: string;
} {
  try {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / 1024 / 1024;

    if (stats.size > APP_MAX_FILE_SIZE) {
      return {
        valid: false,
        sizeMB,
        error: `File size (${sizeMB.toFixed(1)}MB) exceeds ${APP_MAX_FILE_SIZE_MB}MB limit`,
      };
    }

    return { valid: true, sizeMB };
  } catch {
    return {
      valid: false,
      sizeMB: 0,
      error: 'Could not read file',
    };
  }
}

async function transcribeSingle(
  openai: ReturnType<typeof getOpenAIClient>,
  filePath: string,
  offsetSeconds: number
): Promise<TranscriptSegment[]> {
  const audioFile = fs.createReadStream(filePath);

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  const whisperResponse = response as unknown as WhisperResponse;

  if (whisperResponse.segments && whisperResponse.segments.length > 0) {
    return whisperResponse.segments.map((segment) => ({
      text: segment.text.trim(),
      start: segment.start + offsetSeconds,
      duration: segment.end - segment.start,
    }));
  }

  return [
    {
      text: whisperResponse.text || response.text,
      start: offsetSeconds,
      duration: 0,
    },
  ];
}

function quotePath(value: string): string {
  return JSON.stringify(value);
}

async function getAudioDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${quotePath(filePath)}`
    );
    const duration = parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ffprobe') || message.includes('not found')) {
      throw new Error('ffprobe is required to split large audio files');
    }
    throw error;
  }
}

async function splitAudioForWhisper(filePath: string): Promise<{
  chunkPaths: string[];
  cleanup: () => void;
}> {
  const stats = fs.statSync(filePath);
  const durationSeconds = await getAudioDurationSeconds(filePath);

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Could not determine audio duration for chunking');
  }

  const bytesPerSecond = stats.size / durationSeconds;
  if (bytesPerSecond <= 0) {
    throw new Error('Could not estimate audio bitrate for chunking');
  }

  let segmentSeconds = Math.floor(
    (WHISPER_MAX_FILE_SIZE * CHUNK_SAFETY_RATIO) / bytesPerSecond
  );
  segmentSeconds = Math.max(segmentSeconds, MIN_CHUNK_SECONDS);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_SPLIT_ATTEMPTS; attempt += 1) {
    const { chunkPaths, cleanup } = await splitAudioByDuration(
      filePath,
      segmentSeconds
    );

    const maxChunkSize = chunkPaths.reduce((max, chunkPath) => {
      const chunkSize = fs.statSync(chunkPath).size;
      return Math.max(max, chunkSize);
    }, 0);

    if (maxChunkSize <= WHISPER_MAX_FILE_SIZE) {
      return { chunkPaths, cleanup };
    }

    cleanup();

    const ratio = (WHISPER_MAX_FILE_SIZE * CHUNK_SAFETY_RATIO) / maxChunkSize;
    const nextSegmentSeconds = Math.max(
      MIN_CHUNK_SECONDS,
      Math.floor(segmentSeconds * ratio)
    );

    if (nextSegmentSeconds >= segmentSeconds) {
      lastError = new Error(
        `Unable to split audio into ${WHISPER_MAX_FILE_SIZE_MB}MB chunks`
      );
      break;
    }

    segmentSeconds = nextSegmentSeconds;
  }

  throw lastError || new Error('Failed to split audio for transcription');
}

async function splitAudioByDuration(
  filePath: string,
  segmentSeconds: number
): Promise<{ chunkPaths: string[]; cleanup: () => void }> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-chunks-'));
  const extension = path.extname(filePath) || '.mp3';
  const outputPattern = path.join(tempDir, `chunk-%03d${extension}`);

  try {
    await execAsync(
      `ffmpeg -v error -i ${quotePath(filePath)} -f segment -segment_time ${segmentSeconds} -reset_timestamps 1 -c copy ${quotePath(outputPattern)}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (message.includes('ffmpeg') || message.includes('not found')) {
      throw new Error('ffmpeg is required to split large audio files');
    }
    throw error;
  }

  const chunkPaths = fs
    .readdirSync(tempDir)
    .filter((name) => name.startsWith('chunk-'))
    .sort()
    .map((name) => path.join(tempDir, name));

  if (chunkPaths.length === 0) {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw new Error('Audio chunking produced no output');
  }

  return {
    chunkPaths,
    cleanup: () => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  };
}
