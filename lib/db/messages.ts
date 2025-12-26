import { getDatabase, generateId } from './index';
import type { Message } from '../types';

interface MessageRow {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function mapRowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
  };
}

export function getMessagesByChatId(chatId: string): Message[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC
  `).all(chatId) as MessageRow[];

  return rows.map(mapRowToMessage);
}

export function getMessageById(id: string): Message | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM messages WHERE id = ?
  `).get(id) as MessageRow | undefined;

  return row ? mapRowToMessage(row) : null;
}

export function createMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string
): Message {
  const db = getDatabase();
  const id = generateId();

  db.prepare(`
    INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, ?, ?)
  `).run(id, chatId, role, content);

  return getMessageById(id)!;
}

export function getRecentMessages(chatId: string, limit: number = 10): Message[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE chat_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(chatId, limit) as MessageRow[];

  // Return in chronological order
  return rows.map(mapRowToMessage).reverse();
}

export function deleteMessagesByChatId(chatId: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM messages WHERE chat_id = ?`).run(chatId);
}
