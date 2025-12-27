'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from './components/AppShell/AppShell';
import { Sidebar } from './components/Sidebar/Sidebar';
import { VideoInput } from './components/VideoInput/VideoInput';
import { IntentPrompt } from './components/IntentPrompt/IntentPrompt';
import { VideoPlayer } from './components/VideoPlayer/VideoPlayer';
import { Summary } from './components/Summary/Summary';
import { ChatPanel } from './components/ChatPanel/ChatPanel';
import { Dock } from './components/Dock/Dock';
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import type { Video, Summary as SummaryType, Chat } from '@/lib/types';
import styles from './page.module.css';

type AppState = 'input' | 'transcribe' | 'intent' | 'loading' | 'viewing';

export default function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [followMode, setFollowMode] = useState(false);
  const [isDockHidden, setIsDockHidden] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [appState, setAppState] = useState<AppState>('input');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seekTo, setSeekTo] = useState(0);
  const [seekNonce, setSeekNonce] = useState(0);

  const urlVideoId = searchParams.get('videoId');

  const setUrlVideoId = useCallback(
    (videoId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (videoId) params.set('videoId', videoId);
      else params.delete('videoId');
      const query = params.toString();
      router.replace(query ? `/?${query}` : '/', { scroll: false });
    },
    [router, searchParams]
  );

  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch('/api/videos');
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    }
  }, []);

  const loadChatsForVideo = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/chats`);
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        setActiveChat(data.length > 0 ? data[0] : null);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    }
  }, []);

  const handleVideoSelect = useCallback(
    (video: Video, options: { updateUrl?: boolean } = {}) => {
      if (options.updateUrl !== false) {
        setUrlVideoId(video.id);
      }
      setSelectedVideo(video);
      setError(null);
      setCurrentTime(0);
      setSeekTo(0);
      setFollowMode(false);

      // Check if transcript exists
      const transcript = JSON.parse(video.transcript || '[]');
      if (transcript.length === 0) {
        setAppState('transcribe');
        return;
      }

      if (video.summary) {
        void loadChatsForVideo(video.id);
        setAppState('viewing');
      } else {
        setAppState('intent');
      }
    },
    [loadChatsForVideo, setUrlVideoId]
  );

  // Fetch videos on mount
  useEffect(() => {
    void fetchVideos();
  }, [fetchVideos]);

  // Restore selected video from URL (if present).
  useEffect(() => {
    if (!urlVideoId) return;
    if (selectedVideo?.id === urlVideoId) return;

    const match = videos.find((video) => video.id === urlVideoId);
    if (!match) return;

    handleVideoSelect(match, { updateUrl: false });
  }, [handleVideoSelect, urlVideoId, videos, selectedVideo?.id]);

  // If navigation clears `videoId`, reset the UI.
  useEffect(() => {
    if (urlVideoId) return;
    if (!selectedVideo) return;
    setSelectedVideo(null);
    setActiveChat(null);
    setChats([]);
    setError(null);
    setCurrentTime(0);
    setSeekTo(0);
    setFollowMode(false);
    setAppState('input');
  }, [urlVideoId, selectedVideo]);

  useEffect(() => {
    if (!followMode) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFollowMode(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [followMode]);

  async function handleVideoSubmit(url: string) {
    setError(null);
    setAppState('loading');
    setLoadingMessage('Fetching video information...');

    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url }),
      });

      const video = await response.json();

      if (!response.ok) {
        throw new Error(video.error || 'Failed to process video');
      }

      setUrlVideoId(video.id);
      setSelectedVideo(video);
      await fetchVideos();

      // Check if transcript is missing
      const transcript = JSON.parse(video.transcript || '[]');
      if (transcript.length === 0 || video.transcriptMissing) {
        // Show transcription option
        setAppState('transcribe');
        return;
      }

      // Check if video already has a summary
      if (video.summary) {
        await loadChatsForVideo(video.id);
        setAppState('viewing');
      } else {
        setAppState('intent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAppState('input');
    }
  }

  async function handleTranscribe() {
    if (!selectedVideo) return;

    setAppState('loading');
    setLoadingMessage(
      'Downloading audio and transcribing with Whisper... This may take a few minutes.'
    );

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: selectedVideo.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      // Refresh video to get updated transcript
      const videoResponse = await fetch(`/api/videos/${selectedVideo.id}`);
      const updatedVideo = await videoResponse.json();
      setSelectedVideo(updatedVideo);
      await fetchVideos();

      // Move to intent prompt
      setAppState('intent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setAppState('transcribe');
    }
  }

  async function handleIntentSubmit(intent: string) {
    if (!selectedVideo) return;

    setAppState('loading');
    setLoadingMessage('Generating comprehensive summary... This may take a minute.');

    try {
      const response = await fetch(`/api/videos/${selectedVideo.id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIntent: intent }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate summary');
      }

      // Refresh video to get updated summary
      const videoResponse = await fetch(`/api/videos/${selectedVideo.id}`);
      const updatedVideo = await videoResponse.json();
      setSelectedVideo(updatedVideo);

      // Fetch chats
      await loadChatsForVideo(updatedVideo.id);
      setAppState('viewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      setAppState('intent');
    }
  }

  function handleNewVideo() {
    setUrlVideoId(null);
    setSelectedVideo(null);
    setActiveChat(null);
    setChats([]);
    setError(null);
    setAppState('input');
  }

  async function handleNewChat() {
    if (!selectedVideo) return;

    try {
      const response = await fetch(`/api/videos/${selectedVideo.id}/chats`, {
        method: 'POST',
      });
      if (response.ok) {
        const newChat = await response.json();
        setChats([newChat, ...chats]);
        setActiveChat(newChat);
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  }

  const handleTimestampClick = useCallback((timestamp: number) => {
    setCurrentTime(timestamp);
    setSeekTo(timestamp);
    setSeekNonce((prev) => prev + 1);
  }, []);

  const parsedSummary: SummaryType | null = selectedVideo?.summary
    ? JSON.parse(selectedVideo.summary)
    : null;

  return (
    <AppShell
      sidebar={
        <Sidebar
          videos={videos}
          selectedVideo={selectedVideo}
          onVideoSelect={handleVideoSelect}
          onNewVideo={handleNewVideo}
        />
      }
      headerTitle="YouTube Summarizer"
      headerSubtitle={
        selectedVideo ? selectedVideo.title : 'Paste a link to get started'
      }
      headerActions={
        <>
          <button className="btn-secondary" onClick={handleNewVideo}>
            New
          </button>
          <ThemeToggle variant="compact" />
        </>
      }
    >
      {appState === 'loading' && (
        <div className={styles.loadingOverlay}>
          <LoadingSpinner />
          <p className={styles.loadingText}>{loadingMessage}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {appState === 'input' && (
        <div className={styles.welcomeContainer}>
          <svg
            className={styles.welcomeIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </svg>
          <h1 className={styles.welcomeTitle}>Summarize YouTube Videos</h1>
          <p className={styles.welcomeSubtitle}>
            Get timestamped summaries and explore content through conversation
          </p>
          <VideoInput onSubmit={handleVideoSubmit} />
        </div>
      )}

      {appState === 'transcribe' && selectedVideo && (
        <div className={styles.transcribeContainer}>
          <div className={styles.videoPreviewSmall}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedVideo.thumbnailUrl}
              alt={selectedVideo.title}
              className={styles.thumbnailSmall}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src.includes('maxresdefault')) {
                  img.src = img.src.replace('maxresdefault', 'hqdefault');
                }
              }}
            />
            <div className={styles.videoInfoSmall}>
              <h2>{selectedVideo.title}</h2>
              <p>{selectedVideo.channelName}</p>
            </div>
          </div>
          <div className={styles.transcribeMessage}>
            <h3>Transcript Not Available</h3>
            <p>
              This video does not have captions available. You can use OpenAI
              Whisper to transcribe the audio.
            </p>
            <p className={styles.transcribeCost}>
              Estimated cost: ~$0.006 per minute of audio
            </p>
            <div className={styles.transcribeActions}>
              <button className="btn-primary" onClick={handleTranscribe}>
                Transcribe with Whisper
              </button>
              <button className="btn-secondary" onClick={handleNewVideo}>
                Try Another Video
              </button>
            </div>
          </div>
        </div>
      )}

      {appState === 'intent' && selectedVideo && (
        <IntentPrompt video={selectedVideo} onSubmit={handleIntentSubmit} />
      )}

      {appState === 'viewing' && selectedVideo && parsedSummary && (
        <div
          className={`${styles.contentWrapper} ${
            isDockHidden ? styles.dockHidden : ''
          }`}
        >
          <div className={styles.primaryColumn}>
            <Summary
              summary={parsedSummary}
              currentTime={currentTime}
              followMode={followMode}
              onFollowModeToggle={() => setFollowMode(!followMode)}
              onTimestampClick={handleTimestampClick}
              isReaderMode={isDockHidden}
              onReaderModeToggle={() => setIsDockHidden((v) => !v)}
            />
          </div>

          {!isDockHidden ? (
            <div className={styles.sideColumn}>
              <Dock
                video={
                  <VideoPlayer
                    youtubeId={selectedVideo.youtubeId}
                    seekTo={seekTo}
                    seekNonce={seekNonce}
                    onTimeUpdate={setCurrentTime}
                  />
                }
                chat={
                  <ChatPanel
                    videoId={selectedVideo.id}
                    chats={chats}
                    activeChat={activeChat}
                    onChatSelect={setActiveChat}
                    onNewChat={handleNewChat}
                    onTimestampClick={handleTimestampClick}
                  />
                }
              />
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
