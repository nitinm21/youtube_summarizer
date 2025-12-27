import { getDatabase, generateId } from './index';
import type { Video, VideoMetadata, TranscriptSegment, Summary } from '../types';

interface VideoRow {
  id: string;
  youtube_url: string;
  youtube_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  duration: number;
  transcript: string | null;
  user_intent: string | null;
  summary: string | null;
  created_at: string;
}

function mapRowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    youtubeUrl: row.youtube_url,
    youtubeId: row.youtube_id,
    title: row.title,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    duration: row.duration,
    transcript: row.transcript || '[]',
    userIntent: row.user_intent,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

export function getAllVideos(): Video[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM videos ORDER BY created_at DESC
  `).all() as VideoRow[];

  return rows.map(mapRowToVideo);
}

export function getVideoById(id: string): Video | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM videos WHERE id = ?
  `).get(id) as VideoRow | undefined;

  return row ? mapRowToVideo(row) : null;
}

export function getVideoByYoutubeId(youtubeId: string): Video | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM videos WHERE youtube_id = ?
  `).get(youtubeId) as VideoRow | undefined;

  return row ? mapRowToVideo(row) : null;
}

export function createVideo(
  youtubeUrl: string,
  metadata: VideoMetadata,
  transcript: TranscriptSegment[]
): Video {
  const db = getDatabase();
  const id = generateId();

  db.prepare(`
    INSERT INTO videos (id, youtube_url, youtube_id, title, channel_name, thumbnail_url, duration, transcript)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    youtubeUrl,
    metadata.youtubeId,
    metadata.title,
    metadata.channelName,
    metadata.thumbnailUrl,
    metadata.duration,
    JSON.stringify(transcript)
  );

  return getVideoById(id)!;
}

export function updateVideoSummary(id: string, userIntent: string, summary: Summary): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE videos SET user_intent = ?, summary = ? WHERE id = ?
  `).run(userIntent, JSON.stringify(summary), id);
}

export function updateVideoSummaryOnly(id: string, summary: Summary): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE videos SET summary = ? WHERE id = ?
  `).run(JSON.stringify(summary), id);
}

export function updateVideoTranscript(id: string, transcript: TranscriptSegment[]): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE videos SET transcript = ? WHERE id = ?
  `).run(JSON.stringify(transcript), id);
}

export function updateVideoDuration(id: string, duration: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE videos SET duration = ? WHERE id = ?
  `).run(duration, id);
}

export function deleteVideo(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM videos WHERE id = ?`).run(id);
}
