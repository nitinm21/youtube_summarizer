import OpenAI from 'openai';

// Lazy-initialize OpenAI client to avoid build-time errors
let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// GPT-5.2 model configuration
export const MODEL = 'gpt-5.2';

// Reasoning effort levels
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

// Verbosity levels
export type Verbosity = 'low' | 'medium' | 'high';

// Configuration for summary generation (high accuracy)
export const SUMMARY_CONFIG = {
  model: MODEL,
  reasoning: { effort: 'high' as ReasoningEffort },
  text: { verbosity: 'high' as Verbosity },
};

// Configuration for chat responses (balanced speed/quality)
export const CHAT_CONFIG = {
  model: MODEL,
  reasoning: { effort: 'medium' as ReasoningEffort },
  text: { verbosity: 'medium' as Verbosity },
};

// GPT-4o-mini for chapter summaries (fast and cost-effective)
export const CHAPTER_SUMMARY_MODEL = 'gpt-4o-mini';

export const CHAPTER_SUMMARY_CONFIG = {
  model: CHAPTER_SUMMARY_MODEL,
  max_tokens: 300,
  temperature: 0.3,
};

// Helper to format timestamp for display
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
