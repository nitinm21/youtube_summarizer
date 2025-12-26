'use client';

import { useEffect, useRef } from 'react';
import styles from './VideoPlayer.module.css';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoPlayerProps {
  youtubeId: string;
  seekTo: number;
  seekNonce: number;
  onTimeUpdate: (time: number) => void;
}

export function VideoPlayer({ youtubeId, seekTo, seekNonce, onTimeUpdate }: VideoPlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize YouTube player
  useEffect(() => {
    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    function initPlayer() {
      if (containerRef.current && window.YT && window.YT.Player) {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        playerRef.current = new window.YT.Player('youtube-player', {
          videoId: youtubeId,
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              // Start time tracking
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              intervalRef.current = setInterval(() => {
                if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                  try {
                    const time = playerRef.current.getCurrentTime();
                    onTimeUpdate(time);
                  } catch {
                    // Player might not be ready
                  }
                }
              }, 500);
            },
          },
        });
      }
    }

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [youtubeId, onTimeUpdate]);

  // Handle seek changes
  useEffect(() => {
    if (!playerRef.current || seekNonce === 0) {
      return;
    }

    try {
      playerRef.current.seekTo(seekTo, true);
      playerRef.current.playVideo();
    } catch {
      // Player might not be ready
    }
  }, [seekTo, seekNonce]);

  return (
    <div className={styles.container}>
      <div className={styles.playerWrapper} ref={containerRef}>
        <div id="youtube-player" className={styles.player}></div>
      </div>
    </div>
  );
}
