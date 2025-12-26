import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '../types';

export class TranscriptError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_AVAILABLE' | 'DISABLED' | 'FETCH_ERROR'
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}

export async function fetchTranscript(youtubeId: string): Promise<TranscriptSegment[]> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(youtubeId);

    if (!transcript || transcript.length === 0) {
      throw new TranscriptError(
        'No transcript available for this video',
        'NOT_AVAILABLE'
      );
    }

    return transcript.map((segment) => ({
      text: cleanTranscriptText(segment.text),
      start: segment.offset / 1000, // Convert ms to seconds
      duration: segment.duration / 1000,
    }));
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common error patterns
    if (errorMessage.includes('disabled') || errorMessage.includes('Disabled')) {
      throw new TranscriptError(
        'Transcripts are disabled for this video',
        'DISABLED'
      );
    }

    if (errorMessage.includes('not found') || errorMessage.includes('unavailable')) {
      throw new TranscriptError(
        'No transcript available for this video',
        'NOT_AVAILABLE'
      );
    }

    throw new TranscriptError(
      `Failed to fetch transcript: ${errorMessage}`,
      'FETCH_ERROR'
    );
  }
}

// Clean up transcript text (remove HTML entities, extra whitespace, etc.)
function cleanTranscriptText(text: string): string {
  return text
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Remove any remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Combine transcript segments into a full text for AI processing
export function transcriptToFullText(segments: TranscriptSegment[]): string {
  return segments.map((seg) => seg.text).join(' ');
}

// Get transcript with timestamps formatted for display
export function transcriptToTimestampedText(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text}`)
    .join('\n');
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
