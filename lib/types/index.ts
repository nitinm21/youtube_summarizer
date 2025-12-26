// Video entity
export interface Video {
  id: string;
  youtubeUrl: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number; // seconds
  transcript: string; // JSON stringified TranscriptSegment[]
  userIntent: string | null;
  summary: string | null; // JSON stringified Summary
  createdAt: string; // ISO date string
  transcriptMissing?: boolean;
}

export interface TranscriptSegment {
  text: string;
  start: number; // seconds
  duration: number;
}

export interface Summary {
  keyTakeaways: TimestampedPoint[];
  sections: SummarySection[];
  relevantToGoal: TimestampedPoint[];
}

export interface SummarySection {
  title: string;
  startTime: number;
  endTime: number;
  points: TimestampedPoint[];
}

export interface TimestampedPoint {
  content: string;
  timestamp: number; // seconds from start
  endTimestamp?: number;
  quote?: string;
  speaker?: string;
}

// Chat entity
export interface Chat {
  id: string;
  videoId: string;
  createdAt: string;
  messageCount?: number;
  firstMessage?: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// API request/response types
export interface VideoCreateRequest {
  youtubeUrl: string;
}

export interface SummarizeRequest {
  userIntent: string;
}

export interface ChatMessageRequest {
  content: string;
}

// YouTube metadata
export interface VideoMetadata {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number;
  youtubeId: string;
}

// API error response
export interface ApiError {
  error: string;
  details?: string;
}
