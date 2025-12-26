import { getDatabase, generateId } from './index';
import type { Chat } from '../types';

interface ChatRow {
  id: string;
  video_id: string;
  created_at: string;
}

interface ChatWithStats extends ChatRow {
  message_count: number;
  first_message: string | null;
}

function mapRowToChat(row: ChatRow | ChatWithStats): Chat {
  const chat: Chat = {
    id: row.id,
    videoId: row.video_id,
    createdAt: row.created_at,
  };

  if ('message_count' in row) {
    chat.messageCount = row.message_count;
    chat.firstMessage = row.first_message || undefined;
  }

  return chat;
}

export function getChatsByVideoId(videoId: string): Chat[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      c.*,
      COUNT(m.id) as message_count,
      (SELECT content FROM messages WHERE chat_id = c.id AND role = 'user' ORDER BY timestamp ASC LIMIT 1) as first_message
    FROM chats c
    LEFT JOIN messages m ON m.chat_id = c.id
    WHERE c.video_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(videoId) as ChatWithStats[];

  return rows.map(mapRowToChat);
}

export function getChatById(id: string): Chat | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM chats WHERE id = ?
  `).get(id) as ChatRow | undefined;

  return row ? mapRowToChat(row) : null;
}

export function createChat(videoId: string): Chat {
  const db = getDatabase();
  const id = generateId();

  db.prepare(`
    INSERT INTO chats (id, video_id) VALUES (?, ?)
  `).run(id, videoId);

  return getChatById(id)!;
}

export function deleteChat(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM chats WHERE id = ?`).run(id);
}

export function deleteChatsByVideoId(videoId: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM chats WHERE video_id = ?`).run(videoId);
}
