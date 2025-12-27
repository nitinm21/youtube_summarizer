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
}

export function Summary({
  summary,
  currentTime,
  followMode,
  onFollowModeToggle,
  onTimestampClick,
}: SummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef<HTMLDivElement>(null);
  
  // Track expanded sections by index
  // Start with all collapsed to provide a cleaner initial view
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Determine active section index
  const activeSectionIndex = summary.sections.findIndex(
    section => currentTime >= section.startTime && currentTime < section.endTime
  );

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

  function renderPoint(point: TimestampedPoint, index: number) {
    const active = isActive(point.timestamp, point.endTimestamp);

    return (
      <div
        key={index}
        className={`${styles.point} ${active ? styles.active : ''}`}
      >
        <div className={styles.pointContent}>
          <p>{point.content}</p>
          {point.quote && (
            <blockquote className={styles.quote}>
              &ldquo;{point.quote}&rdquo;
              {point.speaker && (
                <cite className={styles.speaker}> — {point.speaker}</cite>
              )}
            </blockquote>
          )}
        </div>
        {renderTimestampBadge(point.timestamp)}
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
        
        {isExpanded && (
          <div className={styles.sectionPoints}>
            {section.points.map((point, i) => renderPoint(point, i))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        <h2 className={styles.title}>Summary</h2>
        <button
          className={`${styles.followToggle} ${followMode ? styles.followActive : ''}`}
          onClick={onFollowModeToggle}
          title={followMode ? 'Turn off auto-scroll' : 'Turn on auto-scroll'}
        >
          {followMode ? 'Following' : 'Follow Mode'}
        </button>
      </div>

      {/* Key Takeaways */}
      <div className={styles.keyTakeaways}>
        <h3 className={styles.sectionLabel}>Key Takeaways</h3>
        <ul className={styles.takeawayList}>
          {summary.keyTakeaways.map((takeaway, index) => (
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
        {summary.sections.map((section, index) => renderSection(section, index))}
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