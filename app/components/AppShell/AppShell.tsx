'use client';

import { useId, useMemo, type ReactNode } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
  sidebar: ReactNode;
  headerTitle: string;
  headerSubtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  sidebar,
  headerTitle,
  headerSubtitle,
  headerActions,
  children,
}: AppShellProps) {
  const mainId = useId();

  const skipHref = useMemo(() => `#${mainId}`, [mainId]);

  return (
    <>
      <a className={styles.skipLink} href={skipHref}>
        Skip to content
      </a>

      <div className={styles.shell}>
        <div className={styles.sidebarColumn}>{sidebar}</div>

        <div className={styles.contentColumn}>
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.brand}>
                <div className={styles.brandTitle}>{headerTitle}</div>
                {headerSubtitle ? (
                  <div className={styles.brandSubtitle} title={headerSubtitle}>
                    {headerSubtitle}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={styles.headerRight}>{headerActions}</div>
          </header>

          <main id={mainId} className={styles.body}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
