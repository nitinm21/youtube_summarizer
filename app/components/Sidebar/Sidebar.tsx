'use client';

import Image from 'next/image';
import type { Video } from '@/lib/types';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import styles from './Sidebar.module.css';

interface SidebarProps {
  videos: Video[];
  selectedVideo: Video | null;
  onVideoSelect: (video: Video) => void;
  onNewVideo: () => void;
}

export function Sidebar({
  videos,
  selectedVideo,
  onVideoSelect,
  onNewVideo,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h1 className={styles.logo}>Summarizer</h1>
        <button className={styles.newButton} onClick={onNewVideo}>
          <span className={styles.newButtonIcon}>+</span>
          New Video
        </button>
      </div>

      {videos.length > 0 && (
        <span className={styles.sectionLabel}>Recent</span>
      )}

      <div className={styles.videoList}>
        {videos.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>No videos yet</p>
            <p className={styles.emptyHint}>
              Paste a YouTube URL to get started
            </p>
          </div>
        ) : (
          videos.map((video) => (
            <button
              key={video.id}
              className={`${styles.videoItem} ${
                selectedVideo?.id === video.id ? styles.selected : ''
              }`}
              onClick={() => onVideoSelect(video)}
            >
              <div className={styles.thumbnail}>
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  width={64}
                  height={36}
                  className={styles.thumbnailImage}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.src.includes('maxresdefault')) {
                      img.src = img.src.replace('maxresdefault', 'hqdefault');
                    }
                  }}
                />
                {video.summary && (
                  <span className={styles.badge}>Done</span>
                )}
              </div>
              <div className={styles.videoInfo}>
                <p className={styles.videoTitle}>{video.title}</p>
                <p className={styles.videoChannel}>{video.channelName}</p>
                <p className={styles.videoDate}>
                  {formatDate(video.createdAt)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
