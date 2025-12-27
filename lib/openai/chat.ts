import { getOpenAIClient, CHAT_CONFIG, formatTimestamp } from './client';
import type { TranscriptSegment, Summary, Message } from '../types';

interface ChatInput {
  title: string;
  userIntent: string;
  transcript: TranscriptSegment[];
  summary: Summary;
  messages: Message[];
  newMessage: string;
}

export async function generateChatResponse(input: ChatInput): Promise<string> {
  const { title, userIntent, transcript, summary, messages, newMessage } = input;

  // Format transcript (limit to prevent context overflow)
  const maxTranscriptChars = 50000;
  let formattedTranscript = '';
  let charCount = 0;

  for (const seg of transcript) {
    const line = `[${formatTimestamp(seg.start)}] ${seg.text}\n`;
    if (charCount + line.length > maxTranscriptChars) {
      formattedTranscript += '\n[... transcript truncated for length ...]';
      break;
    }
    formattedTranscript += line;
    charCount += line.length;
  }

  // Format summary for context
  const summaryContext = formatSummaryForContext(summary);

  const systemPrompt = `You are a helpful assistant with deep knowledge of this podcast episode. Your role is to help the user explore and understand the content.

VIDEO: "${title}"
USER'S LEARNING GOAL: ${userIntent || 'Not specified'}

CRITICAL RULES:
1. ONLY answer based on information present in the transcript and summary
2. NEVER hallucinate or make up information not in the video
3. When mentioning specific content, ALWAYS include the timestamp in format [MM:SS] or [H:MM:SS]
4. If asked about something not covered in the video, explicitly say "This wasn't discussed in the video"
5. Be conversational but accurate
6. Reference specific quotes when relevant

SUMMARY:
${summaryContext}

TRANSCRIPT:
${formattedTranscript}`;

  // Build conversation messages
  const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add recent chat history (last 8 messages for context)
  const recentMessages = messages.slice(-8);
  for (const msg of recentMessages) {
    conversationMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add the new message
  conversationMessages.push({
    role: 'user',
    content: newMessage,
  });

  // Use the GPT-5.2 Responses API
  const openai = getOpenAIClient();
  const response = await (
    openai as unknown as {
      responses: { create: (params: unknown) => Promise<{ output_text: string }> };
    }
  ).responses.create({
    ...CHAT_CONFIG,
    input: conversationMessages,
  });

  return response.output_text;
}

function formatSummaryForContext(summary: Summary): string {
  const parts: string[] = [];

  // Key takeaways
  if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
    parts.push('KEY TAKEAWAYS:');
    for (const takeaway of summary.keyTakeaways) {
      parts.push(`- [${formatTimestamp(takeaway.timestamp)}] ${takeaway.content}`);
    }
  }

  // Sections
  if (summary.sections && summary.sections.length > 0) {
    parts.push('\nSECTIONS:');
    for (const section of summary.sections) {
      parts.push(`\n${section.title} [${formatTimestamp(section.startTime)} - ${formatTimestamp(section.endTime)}]:`);
      for (const point of section.points) {
        let pointText = `  - [${formatTimestamp(point.timestamp)}] ${point.content}`;
        if (point.quote) {
          pointText += ` ("${point.quote}")`;
        }
        parts.push(pointText);
      }
    }
  }

  // Relevant to goal
  if (summary.relevantToGoal && summary.relevantToGoal.length > 0) {
    parts.push('\nRELEVANT TO USER\'S GOAL:');
    for (const item of summary.relevantToGoal) {
      parts.push(`- [${formatTimestamp(item.timestamp)}] ${item.content}`);
    }
  }

  return parts.join('\n');
}

// Find timestamp references in a message and format them as clickable
export function extractTimestampReferences(text: string): Array<{ match: string; seconds: number }> {
  const timestampPattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const references: Array<{ match: string; seconds: number }> = [];

  let match;
  while ((match = timestampPattern.exec(text)) !== null) {
    const timeStr = match[1];
    const parts = timeStr.split(':').map(Number);

    let seconds: number;
    if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      seconds = parts[0] * 60 + parts[1];
    }

    references.push({
      match: match[0],
      seconds,
    });
  }

  return references;
}
