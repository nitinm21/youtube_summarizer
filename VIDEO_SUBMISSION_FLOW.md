# Video Submission & Summarization Flow

This document provides a comprehensive overview of what happens when you submit a YouTube video URL and request a summary in the YouTube Podcast Summarizer application.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Application States](#application-states)
3. [Phase 1: Video Submission](#phase-1-video-submission)
4. [Phase 2: Transcript Acquisition](#phase-2-transcript-acquisition)
5. [Phase 3: Intent Specification](#phase-3-intent-specification)
6. [Phase 4: Summary Generation](#phase-4-summary-generation)
7. [Data Models](#data-models)
8. [Complete Data Flow Diagram](#complete-data-flow-diagram)
9. [Error Handling](#error-handling)
10. [External Dependencies](#external-dependencies)

---

## High-Level Overview

The summarization process follows these major steps:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Submit YouTube │ ──▶ │  Get Transcript  │ ──▶ │  Specify Intent │ ──▶ │ Generate Summary │
│       URL       │     │ (Captions/Whisper)│    │  (Learning Goal)│     │   (GPT-5.2)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
```

---

## Application States

The frontend manages the flow through these states:

| State | Description | Next Possible States |
|-------|-------------|---------------------|
| `input` | Initial state - waiting for YouTube URL | `loading` |
| `loading` | Processing in progress | `transcribe`, `intent`, `viewing`, `input` (on error) |
| `transcribe` | Video has no captions - offer Whisper transcription | `loading`, `input` |
| `intent` | Transcript ready - asking for user's learning goal | `loading` |
| `viewing` | Summary complete - displaying results | `input` (new video) |

---

## Phase 1: Video Submission

### Step 1.1: User Input
**Location:** `app/components/VideoInput/VideoInput.tsx`

The user enters a YouTube URL. The URL can be in any of these formats:
- Standard: `https://www.youtube.com/watch?v=VIDEO_ID`
- Short: `https://youtu.be/VIDEO_ID`
- Embed: `https://www.youtube.com/embed/VIDEO_ID`
- Shorts: `https://www.youtube.com/shorts/VIDEO_ID`

### Step 1.2: Frontend Request
**Location:** `app/page.tsx` → `handleVideoSubmit()`

```typescript
const response = await fetch('/api/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ youtubeUrl: url }),
});
```

**Data Sent:**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=abc123XYZ"
}
```

### Step 1.3: URL Validation
**Location:** `lib/youtube/validation.ts`

1. `validateYoutubeUrl(url)` - Checks if URL matches valid YouTube patterns
2. `extractYoutubeId(url)` - Extracts the 11-character video ID

**Validation Regex Patterns:**
```typescript
/^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
/^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/
/^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
/^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
```

### Step 1.4: Check for Existing Video
**Location:** `app/api/videos/route.ts` → `lib/db/videos.ts`

```typescript
const existingVideo = getVideoByYoutubeId(youtubeId);
if (existingVideo) {
  return NextResponse.json(existingVideo);
}
```

If the video was previously processed, the existing record is returned immediately.

### Step 1.5: Fetch Video Metadata
**Location:** `lib/youtube/metadata.ts` → `fetchVideoMetadata()`

Uses YouTube's **oEmbed API** (no API key required):

```
GET https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={VIDEO_ID}&format=json
```

**Response Data:**
```json
{
  "title": "Video Title",
  "author_name": "Channel Name",
  "thumbnail_url": "..."
}
```

**Metadata Object Created:**
```typescript
{
  title: string,
  channelName: string,
  thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
  duration: 0,  // Calculated from transcript later
  youtubeId: string
}
```

### Step 1.6: Fetch YouTube Captions
**Location:** `lib/youtube/transcript.ts` → `fetchTranscript()`

Uses the `youtube-transcript` npm package to fetch auto-generated or manual captions:

```typescript
const transcript = await YoutubeTranscript.fetchTranscript(youtubeId);
```

**Raw Transcript Segment (from YouTube):**
```typescript
{
  text: "Hello everyone...",
  offset: 5230,      // milliseconds
  duration: 3500     // milliseconds
}
```

**Processed Transcript Segment:**
```typescript
{
  text: "Hello everyone...",
  start: 5.23,       // seconds
  duration: 3.5      // seconds
}
```

**Text Cleanup Applied:**
- HTML entities decoded (`&amp;` → `&`, `&quot;` → `"`, etc.)
- HTML tags removed
- Whitespace normalized

### Step 1.7: Duration Calculation
**Location:** `lib/youtube/metadata.ts` → `calculateDurationFromTranscript()`

```typescript
const lastSegment = transcript[transcript.length - 1];
const duration = Math.ceil(lastSegment.start + lastSegment.duration);
```

**Constraint Check:** Videos longer than 5 hours (18,000 seconds) are rejected.

### Step 1.8: Database Storage
**Location:** `lib/db/videos.ts` → `createVideo()`

```sql
INSERT INTO videos (id, youtube_url, youtube_id, title, channel_name, 
                    thumbnail_url, duration, transcript)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

**Data Stored:**
```typescript
{
  id: "nanoid-generated",
  youtube_url: "https://www.youtube.com/watch?v=...",
  youtube_id: "abc123XYZ",
  title: "Video Title",
  channel_name: "Channel Name",
  thumbnail_url: "https://img.youtube.com/vi/.../maxresdefault.jpg",
  duration: 3600,
  transcript: "[{\"text\":\"...\",\"start\":0,\"duration\":5}...]", // JSON string
  user_intent: null,
  summary: null,
  created_at: "2025-12-25T10:30:00.000Z"
}
```

### Step 1.9: Response to Frontend

**If transcript available:**
```json
{
  "id": "abc123",
  "youtubeId": "VIDEO_ID",
  "title": "Video Title",
  "channelName": "Channel Name",
  "thumbnailUrl": "...",
  "duration": 3600,
  "transcript": "[...]",
  "summary": null,
  "createdAt": "..."
}
```
→ Frontend transitions to `intent` state

**If no transcript (captions disabled):**
```json
{
  "id": "abc123",
  "...": "...",
  "transcript": "[]",
  "transcriptMissing": true,
  "transcriptError": "Transcripts are disabled for this video"
}
```
→ Frontend transitions to `transcribe` state

---

## Phase 2: Transcript Acquisition (Whisper)

This phase only runs if YouTube captions are unavailable.

### Step 2.1: User Initiates Transcription
**Location:** `app/page.tsx` → `handleTranscribe()`

```typescript
const response = await fetch('/api/transcribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ videoId: selectedVideo.id }),
});
```

### Step 2.2: Dependency Check
**Location:** `lib/youtube/audio.ts` → `checkYtDlpInstalled()`

Verifies `yt-dlp` command-line tool is available:
```bash
yt-dlp --version
```

### Step 2.3: Audio Download
**Location:** `lib/youtube/audio.ts` → `downloadYouTubeAudio()`

**Step 2.3.1: Get Video Info**
```bash
yt-dlp --dump-json --no-download "https://www.youtube.com/watch?v=VIDEO_ID"
```
→ Returns video duration and metadata

**Step 2.3.2: Download Audio**
```bash
yt-dlp -x --audio-format mp3 --audio-quality 0 -o "/tmp/yt-audio-VIDEO_ID-TIMESTAMP.%(ext)s" "URL"
```

**Result:**
```typescript
{
  filePath: "/tmp/yt-audio-abc123-1766699274250.mp3",
  duration: 3600,  // seconds
  cleanup: () => { /* deletes temp file */ }
}
```

### Step 2.4: Audio Transcription
**Location:** `lib/openai/whisper.ts` → `transcribeAudio()`

**File Size Handling:**

| File Size | Action |
|-----------|--------|
| ≤ 25 MB | Direct Whisper API call |
| > 25 MB, ≤ 500 MB | Split into chunks, transcribe each |
| > 500 MB | Rejected |

**Whisper API Call:**
```typescript
const response = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  response_format: 'verbose_json',
  timestamp_granularities: ['segment'],
});
```

**Whisper Response:**
```json
{
  "text": "Full transcript text...",
  "segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "text": "Hello everyone and welcome..."
    }
  ]
}
```

**For Large Files (Audio Chunking):**
```bash
# Get duration
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "/path/to/audio.mp3"

# Split into chunks
ffmpeg -v error -i "/path/to/audio.mp3" -f segment -segment_time 300 -reset_timestamps 1 -c copy "/tmp/whisper-chunks-XXXX/chunk-%03d.mp3"
```

Each chunk is transcribed separately, with timestamps adjusted by cumulative offset.

### Step 2.5: Save Transcript
**Location:** `lib/db/videos.ts` → `updateVideoTranscript()`

```sql
UPDATE videos SET transcript = ? WHERE id = ?
```

### Step 2.6: Response to Frontend
```json
{
  "success": true,
  "transcript": [
    { "text": "...", "start": 0, "duration": 5.2 }
  ],
  "segmentCount": 742,
  "estimatedCost": "~$0.36"
}
```

**Cost Calculation:** `$0.006 × (duration_seconds / 60)`

---

## Phase 3: Intent Specification

### Step 3.1: Intent Prompt Display
**Location:** `app/components/IntentPrompt/IntentPrompt.tsx`

User is shown a form asking: "What do you want to learn from this video?"

Example intents:
- "I want to understand the key business strategies discussed"
- "I'm looking for technical implementation details"
- "I want a general overview of the main topics"

### Step 3.2: Intent Submission
**Location:** `app/page.tsx` → `handleIntentSubmit()`

```typescript
const response = await fetch(`/api/videos/${selectedVideo.id}/summarize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userIntent: intent }),
});
```

---

## Phase 4: Summary Generation

### Step 4.1: API Route Handler
**Location:** `app/api/videos/[id]/summarize/route.ts`

1. Validates `userIntent` is provided and non-empty
2. Fetches video from database
3. Parses transcript from JSON string
4. Determines if long-form processing is needed

### Step 4.2: Transcript Length Check

```typescript
const fullText = transcript.map((s) => s.text).join(' ');

if (fullText.length > 100000) {
  // Use chunked processing
  summary = await generateSummaryForLongVideo({ title, transcript, userIntent });
} else {
  // Standard processing
  summary = await generateSummary({ title, transcript, userIntent });
}
```

### Step 4.3: Transcript Formatting
**Location:** `lib/openai/summarize.ts`

Transcript is formatted with timestamps:
```
[0:00] Hello everyone and welcome to today's episode...
[0:05] Today we're going to be discussing...
[1:23] Our first guest is joining us now...
```

### Step 4.4: GPT-5.2 API Call
**Location:** `lib/openai/summarize.ts` → `generateSummary()`

**System Prompt:**
```
You are an expert podcast summarizer. Your task is to create a COMPREHENSIVE 
summary that captures EVERY topic, point, and insight discussed in the video.

CRITICAL REQUIREMENTS FOR ACCURACY:
1. NEVER skip any topic, no matter how brief or tangential
2. NEVER hallucinate or make up information not present in the transcript
3. ONLY include information that is explicitly stated in the transcript
4. Include timestamps for every point (as numbers representing seconds)
5. Capture quotes verbatim with speaker attribution when identifiable
6. Note any disagreements, counterpoints, or nuances raised
7. Structure output as valid JSON matching the exact schema provided

The user's learning goal is: "{userIntent}"
```

**API Configuration:**
```typescript
{
  model: 'gpt-5.2',
  reasoning: { effort: 'high' },
  text: { verbosity: 'high' }
}
```

**API Call:**
```typescript
const response = await openai.responses.create({
  model: 'gpt-5.2',
  reasoning: { effort: 'high' },
  text: { verbosity: 'high' },
  input: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
});
```

### Step 4.5: Summary Response Parsing

**Expected JSON Structure:**
```json
{
  "keyTakeaways": [
    { "content": "Main insight from the video", "timestamp": 123 }
  ],
  "sections": [
    {
      "title": "Introduction and Background",
      "startTime": 0,
      "endTime": 300,
      "points": [
        {
          "content": "The host introduces the topic of...",
          "timestamp": 45,
          "quote": "This is going to change everything",
          "speaker": "John Smith"
        }
      ]
    }
  ],
  "relevantToGoal": [
    { "content": "Content specifically relevant to user's goal", "timestamp": 567 }
  ]
}
```

**Validation:**
```typescript
function validateSummary(summary: Summary): void {
  // Must have keyTakeaways array
  // Must have sections array
  // Must have relevantToGoal array
  // Each section must have: title, startTime (number), endTime (number), points array
}
```

### Step 4.6: Long Video Processing
**Location:** `lib/openai/summarize.ts` → `generateSummaryForLongVideo()`

For transcripts over 100k characters:

1. **Chunking:** Split transcript into ~50k character chunks
2. **Individual Processing:** Generate summary for each chunk
3. **Combination:** Merge all summaries
4. **Deduplication:** Keep first 5 key takeaways

### Step 4.7: Database Update
**Location:** `lib/db/videos.ts` → `updateVideoSummary()`

```sql
UPDATE videos SET user_intent = ?, summary = ? WHERE id = ?
```

### Step 4.8: Response to Frontend
```json
{
  "keyTakeaways": [...],
  "sections": [...],
  "relevantToGoal": [...]
}
```

Frontend refreshes video data and transitions to `viewing` state.

---

## Data Models

### Video Table Schema
```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  transcript TEXT,           -- JSON: TranscriptSegment[]
  user_intent TEXT,
  summary TEXT,              -- JSON: Summary
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### TypeScript Types

```typescript
interface Video {
  id: string;
  youtubeUrl: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number;
  transcript: string;        // JSON stringified
  userIntent: string | null;
  summary: string | null;    // JSON stringified
  createdAt: string;
  transcriptMissing?: boolean;
}

interface TranscriptSegment {
  text: string;
  start: number;    // seconds
  duration: number; // seconds
}

interface Summary {
  keyTakeaways: TimestampedPoint[];
  sections: SummarySection[];
  relevantToGoal: TimestampedPoint[];
}

interface SummarySection {
  title: string;
  startTime: number;
  endTime: number;
  points: TimestampedPoint[];
}

interface TimestampedPoint {
  content: string;
  timestamp: number;
  endTimestamp?: number;
  quote?: string;
  speaker?: string;
}
```

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ YouTube URL
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (app/page.tsx)                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   input     │───▶│   loading   │───▶│ transcribe  │───▶│   intent    │      │
│  │   state     │    │   state     │    │   state     │    │   state     │      │
│  └─────────────┘    └─────────────┘    └──────┬──────┘    └──────┬──────┘      │
│                                               │                   │              │
│                                               │ (if no captions)  │ userIntent   │
│                                               ▼                   ▼              │
│                                        POST /api/          POST /api/           │
│                                        transcribe          videos/{id}/         │
│                                                            summarize            │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                                      │                   │
         │ POST /api/videos                     │                   │
         ▼                                      ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS API ROUTES                                     │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ POST /api/videos │  │ POST /api/       │  │ POST /api/videos/{id}/       │   │
│  │                  │  │ transcribe       │  │ summarize                    │   │
│  │ 1. Validate URL  │  │                  │  │                              │   │
│  │ 2. Get metadata  │  │ 1. Download audio│  │ 1. Parse transcript          │   │
│  │ 3. Get captions  │  │ 2. Transcribe    │  │ 2. Format with timestamps    │   │
│  │ 4. Save to DB    │  │ 3. Save to DB    │  │ 3. Call GPT-5.2              │   │
│  └────────┬─────────┘  └────────┬─────────┘  │ 4. Parse JSON response       │   │
│           │                     │            │ 5. Save to DB                │   │
│           │                     │            └──────────────┬───────────────┘   │
│           │                     │                           │                    │
└───────────┼─────────────────────┼───────────────────────────┼────────────────────┘
            │                     │                           │
            ▼                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            LIBRARY FUNCTIONS                                     │
│                                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ lib/youtube/        │  │ lib/youtube/audio.ts│  │ lib/openai/summarize.ts │  │
│  │ ├── validation.ts   │  │ ├── downloadYouTube │  │ ├── generateSummary()   │  │
│  │ ├── metadata.ts     │  │ │    Audio()        │  │ └── generateSummaryFor  │  │
│  │ └── transcript.ts   │  │ └── checkYtDlp      │  │      LongVideo()        │  │
│  │                     │  │      Installed()    │  │                         │  │
│  │ lib/db/videos.ts    │  │                     │  │ lib/openai/whisper.ts   │  │
│  │ ├── createVideo()   │  │ lib/openai/whisper  │  │ ├── transcribeAudio()   │  │
│  │ └── getVideoBy      │  │ ├── transcribeAudio │  │ └── splitAudioFor       │  │
│  │      YoutubeId()    │  │ └── splitAudioFor   │  │      Whisper()          │  │
│  │                     │  │      Whisper()      │  │                         │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
            │                     │                           │
            ▼                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
│                                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │     YouTube API     │  │      yt-dlp         │  │      OpenAI API         │  │
│  │                     │  │                     │  │                         │  │
│  │ • oEmbed (metadata) │  │ • Audio download    │  │ • Whisper (transcribe)  │  │
│  │ • Captions          │  │ • Video info        │  │ • GPT-5.2 (summarize)   │  │
│  │   (youtube-        │  │                     │  │                         │  │
│  │    transcript pkg) │  │                     │  │                         │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
            │                     │                           │
            ▼                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SQLite DATABASE                                     │
│                                                                                  │
│  videos table:                                                                   │
│  ┌────────┬────────────────────┬────────────────────────────────────────────┐   │
│  │ Column │ Type               │ Description                                │   │
│  ├────────┼────────────────────┼────────────────────────────────────────────┤   │
│  │ id     │ TEXT PRIMARY KEY   │ Unique video identifier (nanoid)           │   │
│  │ youtube│ TEXT               │ YouTube video ID                           │   │
│  │ _id    │                    │                                            │   │
│  │ title  │ TEXT               │ Video title                                │   │
│  │ trans- │ TEXT (JSON)        │ Array of {text, start, duration}           │   │
│  │ cript  │                    │                                            │   │
│  │ summary│ TEXT (JSON)        │ {keyTakeaways, sections, relevantToGoal}   │   │
│  │ user_  │ TEXT               │ User's learning goal                       │   │
│  │ intent │                    │                                            │   │
│  └────────┴────────────────────┴────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### URL Validation Errors
- Invalid YouTube URL format → 400 Bad Request
- Could not extract video ID → 400 Bad Request

### Metadata Fetch Errors
- Video not found or private → 404 from oEmbed API
- Network failure → 500 Internal Server Error

### Transcript Errors
| Error Type | HTTP Status | User Action |
|------------|-------------|-------------|
| Captions disabled | N/A | Offer Whisper transcription |
| Captions unavailable | N/A | Offer Whisper transcription |
| Fetch failure | 500 | Retry or try different video |

### Whisper Transcription Errors
| Error | HTTP Status | Suggestion |
|-------|-------------|------------|
| yt-dlp not installed | 500 | Install via `brew install yt-dlp` |
| Audio too large (>500MB) | 400 | Try shorter video |
| Video private/unavailable | 400 | Use public video |
| ffmpeg not installed | 500 | Install ffmpeg for large files |
| OpenAI API key issue | 500 | Check `.env.local` |

### Summary Generation Errors
| Error | HTTP Status | Suggestion |
|-------|-------------|------------|
| No transcript available | 400 | Run transcription first |
| Invalid transcript data | 400 | Re-process video |
| OpenAI API key issue | 500 | Check `.env.local` |
| Rate limit exceeded | 429 | Wait and retry |
| JSON parse failure | 500 | Retry (AI output issue) |

---

## External Dependencies

### NPM Packages
| Package | Purpose |
|---------|---------|
| `youtube-transcript` | Fetch YouTube captions |
| `openai` | OpenAI API client |
| `better-sqlite3` | Local database |
| `nanoid` | Generate unique IDs |

### System Dependencies
| Tool | Purpose | Required When |
|------|---------|---------------|
| `yt-dlp` | Download YouTube audio | Whisper transcription |
| `ffmpeg` | Split large audio files | Audio > 25MB |
| `ffprobe` | Get audio duration | Audio chunking |

### External APIs
| Service | Endpoint | Rate Limits | Cost |
|---------|----------|-------------|------|
| YouTube oEmbed | `/oembed` | None | Free |
| YouTube Transcript | N/A (scraping) | None | Free |
| OpenAI Whisper | `/audio/transcriptions` | TPM limits | $0.006/min |
| OpenAI GPT-5.2 | `/responses` | TPM limits | Varies |

---

## Summary

The video submission and summarization flow is a multi-phase process:

1. **Video Submission:** Validate URL, fetch metadata, attempt to get YouTube captions
2. **Transcription (if needed):** Download audio via `yt-dlp`, transcribe with Whisper
3. **Intent:** Collect user's learning goal to personalize the summary
4. **Summarization:** Send timestamped transcript to GPT-5.2, parse structured JSON response

All data is persisted to a local SQLite database, allowing previously processed videos to be instantly retrieved on subsequent visits.
