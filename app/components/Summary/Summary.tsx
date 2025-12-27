'use client';

import { useRef, useEffect, useState } from 'react';
import type { Summary as SummaryType, TimestampedPoint, SummarySection } from '@/lib/types';
import styles from './Summary.module.css';

interface SummaryProps {
  summary: SummaryType;
  currentTime: number;
  followMode: boolean;
  onFollowModeToggle: () => void;
  onTimestampClick: (timestamp: number) => void;
  isReaderMode?: boolean;
  onReaderModeToggle?: () => void;
}

export function Summary({
  summary,
  currentTime,
  followMode,
  onFollowModeToggle,
  onTimestampClick,
  isReaderMode,
  onReaderModeToggle,
}: SummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef<HTMLDivElement>(null);
  
  // Track expanded sections by index
  // Start with all collapsed to provide a cleaner initial view
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const [filter, setFilter] = useState('');

  // Track which point is hovered (for tooltip display)
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  // Determine active section index
  const activeSectionIndex = summary.sections.findIndex(
    section => currentTime >= section.startTime && currentTime < section.endTime
  );

  const normalizedFilter = filter.trim().toLowerCase();

  const visibleSections = summary.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => {
      if (!normalizedFilter) return true;
      const inTitle = section.title.toLowerCase().includes(normalizedFilter);
      const inSummary = (section.summary || '').toLowerCase().includes(normalizedFilter);
      const inPoints = section.points.some((point) => {
        const content = point.content.toLowerCase();
        const quote = (point.quote || '').toLowerCase();
        const speaker = (point.speaker || '').toLowerCase();
        return (
          content.includes(normalizedFilter) ||
          quote.includes(normalizedFilter) ||
          speaker.includes(normalizedFilter)
        );
      });
      return inTitle || inSummary || inPoints;
    });

  const visibleKeyTakeaways = summary.keyTakeaways.filter((takeaway) => {
    if (!normalizedFilter) return true;
    return takeaway.content.toLowerCase().includes(normalizedFilter);
  });

  // Auto-scroll and auto-expand active section when follow mode is on
  useEffect(() => {
    if (followMode && activeSectionIndex !== -1) {
      setExpandedSections(prev => {
        const next = new Set(prev);
        next.add(activeSectionIndex);
        return next;
      });
      
      if (activeSectionRef.current) {
        activeSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentTime, followMode, activeSectionIndex]);

  function toggleSection(index: number) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedSections(new Set(summary.sections.map((_, index) => index)));
  }

  function collapseAll() {
    setExpandedSections(new Set());
  }

  const allExpanded =
    summary.sections.length > 0 && expandedSections.size === summary.sections.length;

  function formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function isActive(startTime: number, endTime?: number): boolean {
    if (endTime !== undefined) {
      return currentTime >= startTime && currentTime < endTime;
    }
    return Math.abs(currentTime - startTime) < 30; // Within 30 seconds
  }

  function renderTimestampBadge(timestamp: number) {
    return (
      <button
        className={styles.timestampBadge}
        onClick={(e) => {
          e.stopPropagation();
          onTimestampClick(timestamp);
        }}
        title={`Jump to ${formatTimestamp(timestamp)}`}
      >
        {formatTimestamp(timestamp)}
      </button>
    );
  }

  function renderPoint(point: TimestampedPoint, pointIndex: number, sectionIndex: number) {
    const pointId = `${sectionIndex}-${pointIndex}`;
    const active = isActive(point.timestamp, point.endTimestamp);
    const hasQuote = Boolean(point.quote);
    const isHovered = hoveredPointId === pointId;

    return (
      <div
        key={pointIndex}
        className={`${styles.point} ${active ? styles.active : ''} ${hasQuote ? styles.hasQuote : ''}`}
        onMouseEnter={() => hasQuote && setHoveredPointId(pointId)}
        onMouseLeave={() => setHoveredPointId(null)}
      >
        <div className={styles.pointContent}>
          <p>{point.content}</p>
        </div>
        {renderTimestampBadge(point.timestamp)}

        {/* Quote tooltip - only shown on hover */}
        {hasQuote && isHovered && (
          <div className={styles.quoteTooltip}>
            <span className={styles.tooltipQuote}>&ldquo;{point.quote}&rdquo;</span>
            {point.speaker && (
              <span className={styles.tooltipSpeaker}> — {point.speaker}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderSection(section: SummarySection, index: number) {
    const isTimeActive = index === activeSectionIndex;
    const isExpanded = expandedSections.has(index);

    return (
      <div
        key={index}
        ref={isTimeActive ? activeSectionRef : undefined}
        className={`${styles.section} ${isTimeActive ? styles.activeSection : ''} ${!isExpanded ? styles.collapsed : ''}`}
        id={`section-${index}`}
      >
        <div
          className={styles.sectionHeader}
          onClick={() => toggleSection(index)}
          title={isExpanded ? "Collapse section" : "Expand section"}
        >
          <div className={styles.sectionInfo}>
            <div className={styles.sectionToggle}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
          </div>
          <span className={styles.sectionTime}>
            {formatTimestamp(section.startTime)} - {formatTimestamp(section.endTime)}
          </span>
        </div>

        {/* Chapter summary - always visible */}
        {section.summary && (
          <p className={styles.chapterSummary}>{section.summary}</p>
        )}

        {isExpanded && (
          <div className={styles.sectionPoints}>
            {section.points.map((point, i) => renderPoint(point, i, index))}
          </div>
        )}
      </div>
    );
  }

  function scrollToSection(index: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${index}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Summary</h2>
          <div className={styles.headerMeta}>
            <span className={styles.metaItem}>{summary.sections.length} chapters</span>
            {normalizedFilter ? (
              <span className={styles.metaItem}>
                {visibleSections.length} match{visibleSections.length === 1 ? '' : 'es'}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.search}>
            <svg
              className={styles.searchIcon}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M21 21l-4.3-4.3" />
              <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
            </svg>
            <input
              className={styles.searchInput}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search summary..."
              aria-label="Search summary"
            />
            {filter ? (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => setFilter('')}
                aria-label="Clear search"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => (allExpanded ? collapseAll() : expandAll())}
            title={allExpanded ? 'Collapse all sections' : 'Expand all sections'}
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>

          {onReaderModeToggle ? (
            <button
              type="button"
              className={`${styles.secondaryAction} ${
                isReaderMode ? styles.secondaryActionActive : ''
              }`}
              onClick={onReaderModeToggle}
              aria-pressed={Boolean(isReaderMode)}
              title={isReaderMode ? 'Show video and chat' : 'Hide video and chat'}
            >
              {isReaderMode ? 'Show panel' : 'Reader mode'}
            </button>
          ) : null}

          <button
            className={`${styles.followToggle} ${followMode ? styles.followActive : ''}`}
            onClick={onFollowModeToggle}
            title={followMode ? 'Turn off auto-scroll' : 'Turn on auto-scroll'}
          >
            {followMode ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>

      <div className={styles.outline}>
        <div className={styles.sectionLabel}>Outline</div>
        <div className={styles.outlineList}>
          {visibleSections.slice(0, 12).map(({ section, index }) => (
            <button
              key={index}
              type="button"
              className={`${styles.outlineItem} ${
                index === activeSectionIndex ? styles.outlineItemActive : ''
              }`}
              onClick={() => scrollToSection(index)}
            >
              <span className={styles.outlineTitle}>{section.title}</span>
              <span className={styles.outlineTime}>
                {formatTimestamp(section.startTime)}
              </span>
            </button>
          ))}
          {visibleSections.length > 12 ? (
            <div className={styles.outlineMore}>
              +{visibleSections.length - 12} more chapters
            </div>
          ) : null}
        </div>
      </div>

      {/* Key Takeaways */}
      <div className={styles.keyTakeaways}>
        <h3 className={styles.sectionLabel}>Key Takeaways</h3>
        <ul className={styles.takeawayList}>
          {visibleKeyTakeaways.map((takeaway, index) => (
            <li key={index} className={styles.takeaway}>
              <span className={styles.takeawayContent}>{takeaway.content}</span>
              {renderTimestampBadge(takeaway.timestamp)}
            </li>
          ))}
        </ul>
      </div>

      {/* Detailed Sections */}
      <div className={styles.sections}>
        <h3 className={styles.sectionLabel}>Detailed Summary</h3>
        {visibleSections.length === 0 ? (
          <div className={styles.emptyResults}>
            <p className={styles.emptyTitle}>No matches</p>
            <p className={styles.emptyHint}>
              Try a different search term.
            </p>
          </div>
        ) : (
          visibleSections.map(({ section, index }) => renderSection(section, index))
        )}
      </div>

      {/* Relevant to Goal */}
      {summary.relevantToGoal && summary.relevantToGoal.length > 0 && (
        <div className={styles.relevantToGoal}>
          <h3 className={styles.sectionLabel}>Relevant to Your Goal</h3>
          <ul className={styles.relevantList}>
            {summary.relevantToGoal.map((item, index) => (
              <li key={index} className={styles.relevantItem}>
                <span>{item.content}</span>
                {renderTimestampBadge(item.timestamp)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
