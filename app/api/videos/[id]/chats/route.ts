import { NextRequest, NextResponse } from 'next/server';
import { getChatsByVideoId, createChat } from '@/lib/db/chats';
import { getVideoById } from '@/lib/db/videos';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify video exists
    const video = getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const chats = getChatsByVideoId(id);
    return NextResponse.json(chats);
  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
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

    // Verify video exists
    const video = getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const chat = createChat(id);
    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
