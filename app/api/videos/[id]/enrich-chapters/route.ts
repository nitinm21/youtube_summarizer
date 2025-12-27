import { NextRequest, NextResponse } from 'next/server';
import { getVideoById, updateVideoSummaryOnly } from '@/lib/db/videos';
import { generateChapterSummaries } from '@/lib/openai/summarize';
import type { TranscriptSegment, Summary } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const video = getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    if (!video.summary) {
      return NextResponse.json(
        { error: 'Video has no existing summary. Use /summarize first.' },
        { status: 400 }
      );
    }

    // Parse existing summary
    let existingSummary: Summary;
    try {
      existingSummary = JSON.parse(video.summary);
    } catch {
      return NextResponse.json(
        { error: 'Invalid existing summary data' },
        { status: 400 }
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
        { error: 'No transcript available' },
        { status: 400 }
      );
    }

    // Get user intent (use existing or default)
    const userIntent = video.userIntent || 'general understanding';

    // Generate chapter summaries
    const enrichedSummary = await generateChapterSummaries(
      existingSummary,
      transcript,
      userIntent
    );

    // Save updated summary to database
    updateVideoSummaryOnly(id, enrichedSummary);

    return NextResponse.json(enrichedSummary);
  } catch (error) {
    console.error('Failed to enrich chapters:', error);
    const message = error instanceof Error ? error.message : 'Failed to enrich chapters';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
