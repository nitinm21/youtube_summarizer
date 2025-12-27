'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './Dock.module.css';

type DockTab = 'video' | 'chat';

interface DockProps {
  video: ReactNode;
  chat: ReactNode;
  defaultTab?: DockTab;
}

export function Dock({ video, chat, defaultTab = 'video' }: DockProps) {
  const [tab, setTab] = useState<DockTab>(defaultTab);
  const videoPanelId = useId();
  const chatPanelId = useId();

  return (
    <section className={styles.container} aria-label="Side panel">
      <div className={styles.header}>
        <div className={styles.title}>Panel</div>
        <div className={styles.tabs} role="tablist" aria-label="Panel tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'video'}
            aria-controls={videoPanelId}
            className={`${styles.tab} ${tab === 'video' ? styles.tabActive : ''}`}
            onClick={() => setTab('video')}
          >
            Video
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chat'}
            aria-controls={chatPanelId}
            className={`${styles.tab} ${tab === 'chat' ? styles.tabActive : ''}`}
            onClick={() => setTab('chat')}
          >
            Chat
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div
          className={`${styles.panel} ${tab !== 'video' ? styles.panelHidden : ''}`}
          role="tabpanel"
          id={videoPanelId}
          aria-label="Video"
        >
          <div className={styles.videoPanelInner}>{video}</div>
        </div>
        <div
          className={`${styles.panel} ${tab !== 'chat' ? styles.panelHidden : ''}`}
          role="tabpanel"
          id={chatPanelId}
          aria-label="Chat"
        >
          {chat}
        </div>
      </div>
    </section>
  );
}
