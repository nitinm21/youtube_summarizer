import { NextRequest, NextResponse } from 'next/server';
import { getMessagesByChatId, createMessage, getRecentMessages } from '@/lib/db/messages';
import { getChatById } from '@/lib/db/chats';
import { getVideoById } from '@/lib/db/videos';
import { generateChatResponse } from '@/lib/openai/chat';
import type { TranscriptSegment, Summary } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify chat exists
    const chat = getChatById(id);
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    const messages = getMessagesByChatId(id);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify chat exists
    const chat = getChatById(id);
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get video for context
    const video = getVideoById(chat.videoId);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Save user message
    const userMessage = createMessage(id, 'user', content.trim());

    // Get recent messages for context
    const recentMessages = getRecentMessages(id, 10);

    // Parse transcript and summary
    let transcript: TranscriptSegment[];
    let summary: Summary;

    try {
      transcript = JSON.parse(video.transcript || '[]');
      summary = JSON.parse(video.summary || '{"keyTakeaways":[],"sections":[],"relevantToGoal":[]}');
    } catch {
      return NextResponse.json(
        { error: 'Invalid video data' },
        { status: 500 }
      );
    }

    // Generate AI response
    const aiResponseText = await generateChatResponse({
      title: video.title,
      userIntent: video.userIntent || '',
      transcript,
      summary,
      messages: recentMessages.filter((m) => m.id !== userMessage.id), // Exclude the just-added message
      newMessage: content.trim(),
    });

    // Save assistant message
    const assistantMessage = createMessage(id, 'assistant', aiResponseText);

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error('Failed to process message:', error);

    const message = error instanceof Error ? error.message : 'Failed to process message';

    if (message.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
