import { NextRequest, NextResponse } from 'next/server';
import { getVideoById, updateVideoSummary } from '@/lib/db/videos';
import { generateSummary, generateSummaryForLongVideo, generateChapterSummaries } from '@/lib/openai/summarize';
import type { TranscriptSegment } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userIntent } = body;

    if (!userIntent || typeof userIntent !== 'string' || userIntent.trim().length === 0) {
      return NextResponse.json(
        { error: 'User intent is required' },
        { status: 400 }
      );
    }

    const video = getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Parse transcript
    let transcript: TranscriptSegment[];
    try {
      transcript = JSON.parse(video.transcript || '[]');
    } catch {
      return NextResponse.json(
        { error: 'Invalid transcript data' },
        { status: 400 }
      );
    }

    if (transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available. Please use Whisper transcription first.' },
        { status: 400 }
      );
    }

    // Generate summary using GPT-5.2
    // Use the long video handler for transcripts over 100k chars
    const fullText = transcript.map((s) => s.text).join(' ');
    const baseSummary = fullText.length > 100000
      ? await generateSummaryForLongVideo({
          title: video.title,
          transcript,
          userIntent: userIntent.trim(),
        })
      : await generateSummary({
          title: video.title,
          transcript,
          userIntent: userIntent.trim(),
        });

    // Generate chapter summaries using GPT-4o-mini (cheaper/faster)
    const summary = await generateChapterSummaries(
      baseSummary,
      transcript,
      userIntent.trim()
    );

    // Save summary to database
    updateVideoSummary(id, userIntent.trim(), summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to generate summary:', error);

    // Provide more specific error messages
    const message = error instanceof Error ? error.message : 'Failed to generate summary';

    if (message.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    if (message.includes('rate limit') || message.includes('quota')) {
      return NextResponse.json(
        { error: 'OpenAI API rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
