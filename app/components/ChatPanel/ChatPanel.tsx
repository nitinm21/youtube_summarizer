'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import type { ReactNode } from 'react';
import { ConfirmModal } from '../common/ConfirmModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { Chat, Message } from '@/lib/types';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  videoId: string;
  chats: Chat[];
  activeChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  onNewChat: () => void;
  onTimestampClick: (timestamp: number) => void;
}

function parseTimestampToSeconds(timeStr: string): number {
  const timeParts = timeStr.split(':').map(Number);
  if (timeParts.length === 3) {
    return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  }
  return timeParts[0] * 60 + timeParts[1];
}

function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (/^javascript:/i.test(trimmed)) {
    return '#';
  }
  return trimmed;
}

function renderInline(
  text: string,
  onTimestampClick: (timestamp: number) => void,
  keyPrefix: string
): Array<ReactNode> {
  const nodes: Array<ReactNode> = [];
  let remaining = text;
  let nodeIndex = 0;

  const patterns = [
    { type: 'code', regex: /`([^`]+)`/ },
    { type: 'link', regex: /\[([^\]]+)\]\(([^)]+)\)/ },
    { type: 'timestamp', regex: /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/ },
    { type: 'bold', regex: /\*\*([^*]+)\*\*/ },
    { type: 'italic', regex: /\*([^*]+)\*/ },
  ];

  while (remaining.length > 0) {
    let earliestMatch:
      | { type: string; match: RegExpExecArray; index: number }
      | null = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);
      if (!match) continue;
      if (!earliestMatch || match.index < earliestMatch.index) {
        earliestMatch = { type: pattern.type, match, index: match.index };
      }
    }

    if (!earliestMatch) {
      nodes.push(remaining);
      break;
    }

    if (earliestMatch.index > 0) {
      nodes.push(remaining.slice(0, earliestMatch.index));
    }

    const { type, match } = earliestMatch;
    const key = `${keyPrefix}-${nodeIndex}`;

    if (type === 'code') {
      nodes.push(<code key={key}>{match[1]}</code>);
    } else if (type === 'link') {
      const href = sanitizeHref(match[2]);
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noreferrer">
          {renderInline(match[1], onTimestampClick, `${keyPrefix}-link-${nodeIndex}`)}
        </a>
      );
    } else if (type === 'timestamp') {
      const seconds = parseTimestampToSeconds(match[1]);
      nodes.push(
        <button
          key={key}
          type="button"
          className={styles.timestamp}
          onClick={() => onTimestampClick(seconds)}
        >
          {match[0]}
        </button>
      );
    } else if (type === 'bold') {
      nodes.push(
        <strong key={key}>
          {renderInline(match[1], onTimestampClick, `${keyPrefix}-bold-${nodeIndex}`)}
        </strong>
      );
    } else if (type === 'italic') {
      nodes.push(
        <em key={key}>
          {renderInline(match[1], onTimestampClick, `${keyPrefix}-italic-${nodeIndex}`)}
        </em>
      );
    }

    remaining = remaining.slice(earliestMatch.index + match[0].length);
    nodeIndex += 1;
  }

  return nodes;
}

function renderParagraph(
  text: string,
  onTimestampClick: (timestamp: number) => void,
  keyPrefix: string
): ReactNode {
  const lines = text.split('\n');

  return (
    <p key={keyPrefix}>
      {lines.map((line, index) => (
        <span key={`${keyPrefix}-line-${index}`}>
          {renderInline(line, onTimestampClick, `${keyPrefix}-inline-${index}`)}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

function isListItem(line: string): boolean {
  return /^\s*([-*+])\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
}

function renderMarkdown(
  content: string,
  onTimestampClick: (timestamp: number) => void
): Array<ReactNode> {
  const blocks: Array<ReactNode> = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].trim().startsWith('```')) {
        index += 1;
      }
      blocks.push(
        <pre key={`code-${blockIndex}`}>
          <code data-language={language || undefined}>{codeLines.join('\n')}</code>
        </pre>
      );
      blockIndex += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(
        <HeadingTag key={`heading-${blockIndex}`}>
          {renderInline(headingText, onTimestampClick, `heading-${blockIndex}`)}
        </HeadingTag>
      );
      blockIndex += 1;
      index += 1;
      continue;
    }

    if (isListItem(line)) {
      const isOrdered = /^\s*\d+\.\s+/.test(line);
      const items: Array<string> = [];

      while (index < lines.length && isListItem(lines[index])) {
        const rawLine = lines[index];
        const itemText = isOrdered
          ? rawLine.replace(/^\s*\d+\.\s+/, '')
          : rawLine.replace(/^\s*[-*+]\s+/, '');
        items.push(itemText);
        index += 1;
      }

      const listItems = items.map((item, itemIndex) => (
        <li key={`list-${blockIndex}-${itemIndex}`}>
          {renderInline(item, onTimestampClick, `list-${blockIndex}-${itemIndex}`)}
        </li>
      ));

      blocks.push(
        isOrdered ? (
          <ol key={`list-${blockIndex}`}>{listItems}</ol>
        ) : (
          <ul key={`list-${blockIndex}`}>{listItems}</ul>
        )
      );
      blockIndex += 1;
      continue;
    }

    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${blockIndex}`}>
          {renderParagraph(quoteLines.join('\n'), onTimestampClick, `quote-${blockIndex}`)}
        </blockquote>
      );
      blockIndex += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !lines[index].trim().startsWith('```') &&
      !lines[index].match(/^(#{1,6})\s+/) &&
      !isListItem(lines[index]) &&
      !lines[index].trim().startsWith('>')
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        renderParagraph(
          paragraphLines.join('\n'),
          onTimestampClick,
          `paragraph-${blockIndex}`
        )
      );
      blockIndex += 1;
    }
  }

  return blocks;
}

export function ChatPanel({
  videoId,
  chats,
  activeChat,
  onChatSelect,
  onNewChat,
  onTimestampClick,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages when active chat changes
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id);
    } else {
      setMessages([]);
    }
  }, [activeChat?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchMessages(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;

    // Create chat if needed
    let chatId = activeChat?.id;
    if (!chatId) {
      try {
        const response = await fetch(`/api/videos/${videoId}/chats`, {
          method: 'POST',
        });
        if (response.ok) {
          const newChat = await response.json();
          chatId = newChat.id;
          onChatSelect(newChat);
        } else {
          console.error('Failed to create chat');
          return;
        }
      } catch (error) {
        console.error('Failed to create chat:', error);
        return;
      }
    }

    // At this point chatId is guaranteed to be defined
    if (!chatId) {
      console.error('Chat ID is undefined');
      return;
    }

    const currentChatId = chatId; // Capture for closure

    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: 'temp-user',
      chatId: currentChatId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const { userMessage, assistantMessage } = await response.json();
        // Replace temp message with real ones
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== 'temp-user')
            .concat([userMessage, assistantMessage])
        );
      } else {
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
        console.error('Failed to send message');
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewChat() {
    if (messages.length > 0) {
      setShowConfirm(true);
    } else {
      onNewChat();
    }
  }

  function confirmNewChat() {
    setShowConfirm(false);
    onNewChat();
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Chat</h3>
          {chats.length > 1 && (
            <button
              className={styles.chatSelector}
              onClick={() => setShowChatList(!showChatList)}
            >
              {chats.length} chats
            </button>
          )}
        </div>
        <div className={styles.headerRight}>
          {isLoading && (
            <div className={styles.loadingIndicator}>
              <LoadingSpinner size="small" />
              <span>Generating...</span>
            </div>
          )}
          <button className={styles.newChatButton} onClick={handleNewChat}>
            New Chat
          </button>
        </div>
      </div>

      {showChatList && chats.length > 1 && (
        <div className={styles.chatList}>
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`${styles.chatItem} ${
                chat.id === activeChat?.id ? styles.chatItemActive : ''
              }`}
              onClick={() => {
                onChatSelect(chat);
                setShowChatList(false);
              }}
            >
              <span className={styles.chatPreview}>
                {chat.firstMessage || 'New chat'}
              </span>
              <span className={styles.chatMeta}>
                {chat.messageCount || 0} messages
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Ask questions about the video content</p>
            <p className={styles.emptyHint}>
              The AI has access to the full transcript and summary
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage
                }`}
              >
                <div className={`${styles.messageContent} ${styles.markdown}`}>
                  {renderMarkdown(message.content, onTimestampClick)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                <LoadingSpinner size="small" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the video..."
          className={styles.input}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </form>

      <ConfirmModal
        isOpen={showConfirm}
        title="Start New Chat?"
        message="This will clear the current conversation and start fresh. The video summary will remain."
        confirmText="New Chat"
        cancelText="Cancel"
        onConfirm={confirmNewChat}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
