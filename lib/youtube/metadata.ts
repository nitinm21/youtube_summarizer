import type { VideoMetadata } from '../types';

interface OEmbedResponse {
  title: string;
  author_name: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export async function fetchVideoMetadata(youtubeId: string): Promise<VideoMetadata> {
  // Use YouTube oEmbed API (no API key required)
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;

  const response = await fetch(oembedUrl);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Video not found or is private');
    }
    throw new Error('Failed to fetch video metadata');
  }

  const data: OEmbedResponse = await response.json();

  // Get the best quality thumbnail
  const thumbnailUrl = getBestThumbnail(youtubeId);

  return {
    title: data.title,
    channelName: data.author_name,
    thumbnailUrl,
    duration: 0, // Will be calculated from transcript
    youtubeId,
  };
}

function getBestThumbnail(youtubeId: string): string {
  // Try maxresdefault first, fallback to hqdefault
  // The actual checking happens client-side if needed
  return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
}

// Calculate duration from transcript
export function calculateDurationFromTranscript(
  transcript: { start: number; duration: number }[]
): number {
  if (!transcript || transcript.length === 0) {
    return 0;
  }

  const lastSegment = transcript[transcript.length - 1];
  return Math.ceil(lastSegment.start + lastSegment.duration);
}

// Format duration for display
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Check if duration exceeds maximum (5 hours = 18000 seconds)
export function isDurationExceeded(seconds: number): boolean {
  const MAX_DURATION = 5 * 60 * 60; // 5 hours in seconds
  return seconds > MAX_DURATION;
}
