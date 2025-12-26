'use client';

import { useState, FormEvent } from 'react';
import styles from './VideoInput.module.css';

interface VideoInputProps {
  onSubmit: (url: string) => void;
}

export function VideoInput({ onSubmit }: VideoInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYoutubeUrl(trimmedUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    onSubmit(trimmedUrl);
  }

  function isValidYoutubeUrl(urlString: string): boolean {
    const patterns = [
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /youtube\.com\/shorts\//,
    ];
    return patterns.some((pattern) => pattern.test(urlString));
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="Paste a YouTube URL..."
          className={styles.input}
          autoFocus
        />
        <button type="submit" className={styles.submitButton}>
          Summarize
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.hint}>
        Podcasts, interviews, educational videos, and more
      </p>
    </form>
  );
}
