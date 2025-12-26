'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import type { Video } from '@/lib/types';
import styles from './IntentPrompt.module.css';

interface IntentPromptProps {
  video: Video;
  onSubmit: (intent: string) => void;
}

export function IntentPrompt({ video, onSubmit }: IntentPromptProps) {
  const [intent, setIntent] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedIntent = intent.trim();
    if (trimmedIntent) {
      onSubmit(trimmedIntent);
    }
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  return (
    <div className={styles.container}>
      <div className={styles.videoPreview}>
        <div className={styles.thumbnail}>
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            width={280}
            height={158}
            className={styles.thumbnailImage}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.src.includes('maxresdefault')) {
                img.src = img.src.replace('maxresdefault', 'hqdefault');
              }
            }}
          />
        </div>
        <h2 className={styles.title}>{video.title}</h2>
        <p className={styles.meta}>
          {video.channelName}
          {video.duration > 0 && ` · ${formatDuration(video.duration)}`}
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          What do you want to learn from this video?
        </label>
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g., Key arguments about AI safety, main insights, actionable advice..."
          className={styles.textarea}
          rows={3}
          autoFocus
        />
        <p className={styles.hint}>
          This helps customize the summary to highlight what matters to you.
        </p>
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!intent.trim()}
          >
            Generate Summary
          </button>
        </div>
      </form>
    </div>
  );
}
