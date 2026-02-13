/**
 * ChatInput — Self-contained auto-resizing textarea with send button.
 * Zero external dependencies. All styles embedded via CSS-in-JS.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   value={input}
 *   onChange={setInput}
 *   onSend={handleSend}
 *   disabled={isGenerating}
 *   placeholder="Type a message..."
 * />
 * ```
 */

import * as React from 'react';
import { useRef, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ChatInputProps {
  /** Current value of the input */
  value: string;

  /** Called when value changes */
  onChange: (value: string) => void;

  /** Called when user submits (Enter or send button) */
  onSend: () => void;

  /** Called when user clicks stop */
  onStop?: () => void;

  /** Whether the input is disabled (e.g. during generation) */
  disabled?: boolean;

  /** Whether currently generating (shows stop button instead of send) */
  isGenerating?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Maximum rows before scrolling */
  maxRows?: number;

  /** Optional action elements to render in the toolbar */
  actions?: React.ReactNode;

  /** Theme */
  theme?: 'dark' | 'light';

  /** Additional className for the container */
  className?: string;
}

// ============================================================================
// Inline SVG Icons
// ============================================================================

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

// ============================================================================
// Styles
// ============================================================================

const STYLE_ID = '__llm-chat-input-styles';

function injectStyles(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const isDark = theme === 'dark';

  const css = `
    .llm-ci {
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)'};
      background: ${isDark ? 'rgba(17,17,17,0.95)' : 'rgba(255,255,255,0.98)'};
      padding: 8px;
      transition: border-color 0.2s, box-shadow 0.2s;
      position: relative;
    }
    .llm-ci:focus-within {
      border-color: ${isDark ? 'rgba(56,189,248,0.4)' : 'rgba(59,130,246,0.4)'};
      box-shadow: 0 0 0 2px ${isDark ? 'rgba(56,189,248,0.1)' : 'rgba(59,130,246,0.1)'};
    }
    .llm-ci textarea {
      width: 100%;
      min-height: 40px;
      max-height: 160px;
      resize: none;
      border: none;
      outline: none;
      background: transparent;
      color: ${isDark ? '#e5e5e5' : '#1a1a1a'};
      font-size: 14px;
      line-height: 1.5;
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      scrollbar-width: thin;
    }
    .llm-ci textarea::placeholder {
      color: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'};
    }
    .llm-ci-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 4px 0;
    }
    .llm-ci-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .llm-ci-send {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .llm-ci-send--active {
      background: ${isDark ? '#38bdf8' : '#3b82f6'};
      color: white;
    }
    .llm-ci-send--active:hover {
      background: ${isDark ? '#0ea5e9' : '#2563eb'};
      transform: scale(1.05);
    }
    .llm-ci-send--disabled {
      background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
      color: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
      cursor: not-allowed;
    }
    .llm-ci-send--stop {
      background: ${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'};
      color: ${isDark ? '#f87171' : '#ef4444'};
    }
    .llm-ci-send--stop:hover {
      background: ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'};
    }
  `;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================================
// Component
// ============================================================================

function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isGenerating = false,
  placeholder = 'Type a message...',
  maxRows = 5,
  actions,
  theme = 'dark',
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inject styles
  useEffect(() => {
    injectStyles(theme);
  }, [theme]);

  // Auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const lineHeight = 21; // ~14px * 1.5 line-height
    const maxHeight = lineHeight * maxRows + 16; // padding
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, maxRows]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) {
          onSend();
        }
      }
    },
    [disabled, value, onSend]
  );

  const hasValue = value.trim().length > 0;
  const canSend = hasValue && !disabled && !isGenerating;

  let sendClass = 'llm-ci-send';
  if (isGenerating) {
    sendClass += ' llm-ci-send--stop';
  } else if (canSend) {
    sendClass += ' llm-ci-send--active';
  } else {
    sendClass += ' llm-ci-send--disabled';
  }

  return (
    <div className={`llm-ci${className ? ` ${className}` : ''}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled && !isGenerating}
        rows={1}
      />
      <div className="llm-ci-toolbar">
        <div className="llm-ci-actions">
          {actions}
        </div>
        <button
          type="button"
          className={sendClass}
          onClick={isGenerating ? onStop : onSend}
          disabled={!isGenerating && !canSend}
          aria-label={isGenerating ? 'Stop generation' : 'Send message'}
        >
          {isGenerating ? <StopIcon /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

export { ChatInput };
