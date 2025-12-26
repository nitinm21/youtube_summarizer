import { getOpenAIClient, SUMMARY_CONFIG, formatTimestamp } from './client';
import type { TranscriptSegment, Summary } from '../types';

interface SummarizeInput {
  title: string;
  transcript: TranscriptSegment[];
  userIntent: string;
}

export async function generateSummary(input: SummarizeInput): Promise<Summary> {
  const { title, transcript, userIntent } = input;

  // Format transcript with timestamps
  const formattedTranscript = transcript
    .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text}`)
    .join('\n');

  const systemPrompt = `You are an expert podcast summarizer. Your task is to create a COMPREHENSIVE summary that captures EVERY topic, point, and insight discussed in the video.

CRITICAL REQUIREMENTS FOR ACCURACY:
1. NEVER skip any topic, no matter how brief or tangential
2. NEVER hallucinate or make up information not present in the transcript
3. ONLY include information that is explicitly stated in the transcript
4. Include timestamps for every point (as numbers representing seconds from start)
5. Capture quotes verbatim with speaker attribution when identifiable
6. Note any disagreements, counterpoints, or nuances raised
7. Structure output as valid JSON matching the exact schema provided

The user's learning goal is: "${userIntent}"

Pay special attention to content that addresses this goal and highlight it in the "relevantToGoal" section.`;

  const userPrompt = `VIDEO TITLE: ${title}

TRANSCRIPT:
${formattedTranscript}

Generate a comprehensive summary as JSON with this EXACT structure. All timestamps must be numbers (seconds from start):

{
  "keyTakeaways": [
    { "content": "Main insight or takeaway from the video", "timestamp": 123 }
  ],
  "sections": [
    {
      "title": "Descriptive Section Title",
      "startTime": 0,
      "endTime": 300,
      "points": [
        {
          "content": "Detailed point with context",
          "timestamp": 45,
          "quote": "Exact quote if notable (optional)",
          "speaker": "Speaker name if identifiable (optional)"
        }
      ]
    }
  ],
  "relevantToGoal": [
    { "content": "Content specifically relevant to user's stated learning goal", "timestamp": 567 }
  ]
}

IMPORTANT:
- All timestamps must be INTEGER numbers (seconds), not strings
- Provide 3-5 key takeaways
- Create logical sections that follow the video's structure
- Each section should have multiple points covering all discussed topics
- The relevantToGoal section should highlight parts most useful for: "${userIntent}"
- Return ONLY valid JSON, no markdown formatting or explanation`;

  // Use the GPT-5.2 Responses API
  const openai = getOpenAIClient();
  const response = await (openai as any).responses.create({
    ...SUMMARY_CONFIG,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  // Extract the output text
  const outputText = response.output_text;

  // Parse the JSON response
  try {
    // Remove any markdown code blocks if present
    const cleanJson = outputText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const summary: Summary = JSON.parse(cleanJson);

    // Validate the structure
    validateSummary(summary);

    return summary;
  } catch (parseError) {
    console.error('Failed to parse summary JSON:', parseError);
    console.error('Raw output:', outputText);
    throw new Error('Failed to parse AI response as valid JSON');
  }
}

function validateSummary(summary: Summary): void {
  if (!summary.keyTakeaways || !Array.isArray(summary.keyTakeaways)) {
    throw new Error('Invalid summary: missing keyTakeaways array');
  }

  if (!summary.sections || !Array.isArray(summary.sections)) {
    throw new Error('Invalid summary: missing sections array');
  }

  if (!summary.relevantToGoal || !Array.isArray(summary.relevantToGoal)) {
    throw new Error('Invalid summary: missing relevantToGoal array');
  }

  // Validate each section has required fields
  for (const section of summary.sections) {
    if (typeof section.title !== 'string') {
      throw new Error('Invalid section: missing title');
    }
    if (typeof section.startTime !== 'number') {
      throw new Error('Invalid section: startTime must be a number');
    }
    if (typeof section.endTime !== 'number') {
      throw new Error('Invalid section: endTime must be a number');
    }
    if (!Array.isArray(section.points)) {
      throw new Error('Invalid section: missing points array');
    }
  }
}

// For very long transcripts, we may need to summarize in chunks
export async function generateSummaryForLongVideo(
  input: SummarizeInput
): Promise<Summary> {
  const { transcript } = input;

  // If transcript is under 100k characters, process normally
  const fullText = transcript.map((s) => s.text).join(' ');
  if (fullText.length < 100000) {
    return generateSummary(input);
  }

  // For very long videos, chunk the transcript
  const chunkSize = 50000; // characters per chunk
  const chunks: TranscriptSegment[][] = [];
  let currentChunk: TranscriptSegment[] = [];
  let currentLength = 0;

  for (const segment of transcript) {
    if (currentLength + segment.text.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(segment);
    currentLength += segment.text.length;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Process each chunk and combine
  const chunkSummaries: Summary[] = [];
  for (const chunk of chunks) {
    const summary = await generateSummary({
      ...input,
      transcript: chunk,
    });
    chunkSummaries.push(summary);
  }

  // Combine summaries
  return combineSummaries(chunkSummaries);
}

function combineSummaries(summaries: Summary[]): Summary {
  const combined: Summary = {
    keyTakeaways: [],
    sections: [],
    relevantToGoal: [],
  };

  for (const summary of summaries) {
    combined.keyTakeaways.push(...summary.keyTakeaways);
    combined.sections.push(...summary.sections);
    combined.relevantToGoal.push(...summary.relevantToGoal);
  }

  // Deduplicate key takeaways (keep first 5)
  combined.keyTakeaways = combined.keyTakeaways.slice(0, 5);

  return combined;
}
