import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface AudioDownloadResult {
  filePath: string;
  duration: number;
  cleanup: () => void;
}

export async function downloadYouTubeAudio(youtubeId: string): Promise<AudioDownloadResult> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;

  // Create a temporary file path
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `yt-audio-${youtubeId}-${Date.now()}`);

  try {
    // First, get video info to check duration
    const { stdout: infoJson } = await execAsync(
      `yt-dlp --dump-json --no-download "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    const videoInfo = JSON.parse(infoJson);
    const duration = videoInfo.duration || 0;

    // Download audio only, best quality, convert to mp3 for Whisper compatibility
    // yt-dlp will add the extension automatically
    await execAsync(
      `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${tempFilePath}.%(ext)s" "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    // Find the output file (yt-dlp adds extension)
    const outputFile = `${tempFilePath}.mp3`;

    if (!fs.existsSync(outputFile)) {
      throw new Error('Audio file was not created');
    }

    return {
      filePath: outputFile,
      duration,
      cleanup: () => {
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }
      },
    };
  } catch (error) {
    // Clean up any partial files
    const possibleFiles = [
      `${tempFilePath}.mp3`,
      `${tempFilePath}.m4a`,
      `${tempFilePath}.webm`,
      `${tempFilePath}.opus`,
    ];

    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Video unavailable') || message.includes('Private video')) {
      throw new Error('This video is private or unavailable');
    }

    if (message.includes('age-restricted')) {
      throw new Error('This video is age-restricted and cannot be downloaded');
    }

    throw new Error(`Failed to download audio: ${message}`);
  }
}

// Check if yt-dlp is installed
export async function checkYtDlpInstalled(): Promise<boolean> {
  try {
    await execAsync('yt-dlp --version');
    return true;
  } catch {
    return false;
  }
}

// Get video info without downloading
export async function getVideoInfo(youtubeId: string): Promise<{
  title: string;
  duration: number;
  channel: string;
}> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;

  const { stdout } = await execAsync(
    `yt-dlp --dump-json --no-download "${url}"`,
    { maxBuffer: 10 * 1024 * 1024 }
  );

  const info = JSON.parse(stdout);

  return {
    title: info.title,
    duration: info.duration || 0,
    channel: info.channel || info.uploader || 'Unknown',
  };
}
