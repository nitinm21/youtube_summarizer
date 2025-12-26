import { NextRequest, NextResponse } from 'next/server';
import { getAllVideos, createVideo, getVideoByYoutubeId } from '@/lib/db/videos';
import { fetchVideoMetadata, calculateDurationFromTranscript, isDurationExceeded } from '@/lib/youtube/metadata';
import { fetchTranscript, TranscriptError } from '@/lib/youtube/transcript';
import { extractYoutubeId, validateYoutubeUrl } from '@/lib/youtube/validation';

export async function GET() {
  try {
    const videos = getAllVideos();
    return NextResponse.json(videos);
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeUrl } = body;

    // Validate URL
    if (!youtubeUrl || !validateYoutubeUrl(youtubeUrl)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const youtubeId = extractYoutubeId(youtubeUrl);
    if (!youtubeId) {
      return NextResponse.json(
        { error: 'Could not extract video ID from URL' },
        { status: 400 }
      );
    }

    // Check if video already exists
    const existingVideo = getVideoByYoutubeId(youtubeId);
    if (existingVideo) {
      return NextResponse.json(existingVideo);
    }

    // Fetch metadata
    let metadata;
    try {
      metadata = await fetchVideoMetadata(youtubeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch video metadata';
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    // Fetch transcript
    let transcript;
    try {
      transcript = await fetchTranscript(youtubeId);
    } catch (error) {
      if (error instanceof TranscriptError) {
        // Create video without transcript, will offer Whisper option
        const video = createVideo(youtubeUrl, metadata, []);
        return NextResponse.json({
          ...video,
          transcriptMissing: true,
          transcriptError: error.message,
        });
      }
      throw error;
    }

    // Calculate duration from transcript
    const duration = calculateDurationFromTranscript(transcript);
    metadata.duration = duration;

    // Check duration constraint (5 hours max)
    if (isDurationExceeded(duration)) {
      return NextResponse.json(
        { error: 'Video exceeds maximum length of 5 hours' },
        { status: 400 }
      );
    }

    // Create video
    const video = createVideo(youtubeUrl, metadata, transcript);

    return NextResponse.json(video);
  } catch (error) {
    console.error('Failed to create video:', error);
    return NextResponse.json(
      { error: 'Failed to process video' },
      { status: 500 }
    );
  }
}
