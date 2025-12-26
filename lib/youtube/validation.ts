const YOUTUBE_URL_PATTERNS = [
  // Standard watch URLs
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  // Short URLs
  /^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/,
  // Embed URLs
  /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  // Old-style URLs
  /^https?:\/\/(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  // Shorts URLs
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export function validateYoutubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();
  return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(trimmedUrl));
}

export function extractYoutubeId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Try each pattern
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      // The video ID is in capture group 1 for short URLs, group 2 for full URLs
      return match[2] || match[1];
    }
  }

  // Also try to extract from query string for edge cases
  try {
    const urlObj = new URL(trimmedUrl);
    const videoId = urlObj.searchParams.get('v');
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }
  } catch {
    // Invalid URL
  }

  return null;
}

export function normalizeYoutubeUrl(url: string): string | null {
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}
