import { NextRequest, NextResponse } from 'next/server';
import { getVideoById, updateVideoTranscript, updateVideoDuration } from '@/lib/db/videos';
import { downloadYouTubeAudio, checkYtDlpInstalled } from '@/lib/youtube/audio';
import { transcribeAudio, estimateTranscriptionCost } from '@/lib/openai/whisper';
import { isDurationExceeded } from '@/lib/youtube/metadata';

export async function POST(request: NextRequest) {
  let cleanup: (() => void) | null = null;

  try {
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Check if yt-dlp is installed
    const ytDlpInstalled = await checkYtDlpInstalled();
    if (!ytDlpInstalled) {
      return NextResponse.json(
        {
          error: 'yt-dlp is not installed',
          suggestion: 'Install yt-dlp with: brew install yt-dlp (macOS) or pip install yt-dlp',
        },
        { status: 500 }
      );
    }

    const video = getVideoById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if video already has a transcript
    const existingTranscript = JSON.parse(video.transcript || '[]');
    if (existingTranscript.length > 0) {
      return NextResponse.json({
        message: 'Video already has a transcript',
        transcript: existingTranscript,
      });
    }

    console.log(`Starting transcription for video: ${video.title}`);

    // Step 1: Download audio from YouTube
    console.log('Downloading audio...');
    const audioResult = await downloadYouTubeAudio(video.youtubeId);
    cleanup = audioResult.cleanup;

    // Update video duration if we got it from ytdl
    if (audioResult.duration > 0 && video.duration === 0) {
      updateVideoDuration(videoId, audioResult.duration);
    }

    // Check duration constraint (5 hours max)
    if (isDurationExceeded(audioResult.duration)) {
      cleanup();
      return NextResponse.json(
        { error: 'Video exceeds maximum length of 5 hours' },
        { status: 400 }
      );
    }

    // Step 2: Transcribe with Whisper
    console.log('Transcribing with Whisper...');
    const transcript = await transcribeAudio(audioResult.filePath);

    // Step 3: Clean up the audio file
    cleanup();
    cleanup = null;

    // Step 4: Save transcript to database
    updateVideoTranscript(videoId, transcript);

    console.log(`Transcription complete: ${transcript.length} segments`);

    return NextResponse.json({
      success: true,
      transcript,
      segmentCount: transcript.length,
      estimatedCost: estimateTranscriptionCost(audioResult.duration),
    });
  } catch (error) {
    // Clean up on error
    if (cleanup) {
      cleanup();
    }

    console.error('Transcription failed:', error);

    const message = error instanceof Error ? error.message : 'Transcription failed';

    // Provide helpful error messages
    if (message.includes('too large')) {
      return NextResponse.json(
        {
          error: message,
          suggestion: 'Try a shorter video or lower-quality audio',
        },
        { status: 400 }
      );
    }

    if (message.includes('private') || message.includes('unavailable')) {
      return NextResponse.json(
        {
          error: 'This video is private or unavailable',
          suggestion: 'Make sure the video is publicly accessible',
        },
        { status: 400 }
      );
    }

    if (message.includes('API key') || message.includes('authentication')) {
      return NextResponse.json(
        {
          error: 'OpenAI API key issue',
          suggestion: 'Check that your OPENAI_API_KEY is set correctly in .env.local',
        },
        { status: 500 }
      );
    }

    if (message.includes('ffmpeg') || message.includes('ffprobe')) {
      return NextResponse.json(
        {
          error: message,
          suggestion: 'Install ffmpeg to enable large-audio chunking',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// GET endpoint to check transcription status/estimate
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json(
      { error: 'Video ID is required' },
      { status: 400 }
    );
  }

  const video = getVideoById(videoId);
  if (!video) {
    return NextResponse.json(
      { error: 'Video not found' },
      { status: 404 }
    );
  }

  const hasTranscript = JSON.parse(video.transcript || '[]').length > 0;
  const estimatedCost = video.duration > 0
    ? estimateTranscriptionCost(video.duration)
    : 'Unknown (duration not available)';

  return NextResponse.json({
    hasTranscript,
    duration: video.duration,
    estimatedCost,
  });
}
