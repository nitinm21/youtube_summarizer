export const createTablesSQL = `
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    youtube_url TEXT NOT NULL,
    youtube_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    transcript TEXT,
    user_intent TEXT,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chats_video_id ON chats(video_id);
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
  CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
`;
