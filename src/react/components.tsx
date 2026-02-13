/**
 * Chat — A complete, self-contained chat interface for @blank-utils/llm.
 * Drop inside <LLMProvider> and get a working chat UI in one line.
 *
 * Zero external dependencies. All styles embedded.
 *
 * @example
 * ```tsx
 * import { LLMProvider, Chat } from "@blank-utils/llm/react";
 *
 * function App() {
 *   return (
 *     <LLMProvider model="qwen-2.5-0.5b">
 *       <Chat />
 *     </LLMProvider>
 *   );
 * }
 * ```
 */

import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import { useLLM } from './index';
import type { UseChatOptions } from './index';
import { ChatInput, type ChatInputProps } from './chat-input';

// We need useChat but can't import from index without circular dep at runtime.
// useChat is defined in the same module, so we import the hook creator directly.
// Actually, since this file is imported BY index.tsx which then exports it,
// and useChat is also in index.tsx, we can import from index.
// The bundler handles this fine since it's all in the same compilation unit.

// ============================================================================
// Types
// ============================================================================

export interface ChatProps {
  /** System prompt for the conversation */
  systemPrompt?: string;

  /** Placeholder text for the input */
  placeholder?: string;

  /** Theme */
  theme?: 'dark' | 'light';

  /** Additional className for the outermost container */
  className?: string;

  /** Maximum height of the chat container. Default: '600px' */
  maxHeight?: string;

  /** Options passed to useChat internally */
  chatOptions?: Omit<UseChatOptions, 'systemPrompt'>;

  /** Custom actions rendered in the input toolbar */
  inputActions?: React.ReactNode;

  /** Called when a message is sent */
  onSend?: (message: string) => void;

  /** Called when a response is received */
  onResponse?: (response: string) => void;

  /** Called on error */
  onError?: (error: Error) => void;

  /** Whether to show the model info header. Default: true */
  showHeader?: boolean;

  /** Whether to show loading progress. Default: true */
  showProgress?: boolean;

  /** Custom welcome message when chat is empty */
  welcomeMessage?: string;
}

// ============================================================================
// Inline SVG Icons
// ============================================================================

function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// ============================================================================
// Styles
// ============================================================================

const STYLE_ID = '__llm-chat-styles';

function injectChatStyles(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const d = theme === 'dark';

  const css = `
    .llm-chat {
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'};
      background: ${d ? '#0a0a0a' : '#fafafa'};
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${d ? '#e5e5e5' : '#1a1a1a'};
    }

    /* Header */
    .llm-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
      font-size: 12px;
      color: ${d ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'};
    }
    .llm-chat-header-model {
      font-weight: 600;
      color: ${d ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'};
    }
    .llm-chat-header-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .llm-chat-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .llm-chat-dot--loading {
      background: #f59e0b;
      animation: llm-pulse 1.5s ease-in-out infinite;
    }
    .llm-chat-dot--ready {
      background: #22c55e;
    }
    .llm-chat-dot--error {
      background: #ef4444;
    }

    /* Progress */
    .llm-chat-progress {
      padding: 0 16px 8px;
    }
    .llm-chat-progress-bar {
      height: 3px;
      border-radius: 2px;
      background: ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
      overflow: hidden;
    }
    .llm-chat-progress-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      transition: width 0.3s ease;
    }
    .llm-chat-progress-text {
      font-size: 11px;
      color: ${d ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'};
      margin-top: 4px;
    }

    /* Messages */
    .llm-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: ${d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} transparent;
    }

    /* Welcome */
    .llm-chat-welcome {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      color: ${d ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
      font-size: 14px;
      padding: 40px 20px;
      line-height: 1.5;
    }

    /* Bubble */
    .llm-chat-bubble {
      display: flex;
      max-width: 80%;
      animation: llm-fadein 0.2s ease;
    }
    .llm-chat-bubble--user {
      align-self: flex-end;
    }
    .llm-chat-bubble--assistant {
      align-self: flex-start;
    }
    .llm-chat-bubble-content {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .llm-chat-bubble--user .llm-chat-bubble-content {
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .llm-chat-bubble--assistant .llm-chat-bubble-content {
      background: ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'};
      color: ${d ? '#d4d4d4' : '#333'};
      border-bottom-left-radius: 4px;
    }

    /* Streaming */
    .llm-chat-streaming .llm-chat-bubble-content {
      border: 1px solid ${d ? 'rgba(56,189,248,0.2)' : 'rgba(59,130,246,0.2)'};
    }
    .llm-chat-cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background: ${d ? '#38bdf8' : '#3b82f6'};
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: llm-blink 0.8s step-end infinite;
    }

    /* Pending */
    .llm-chat-pending {
      display: flex;
      justify-content: center;
      animation: llm-fadein 0.3s ease;
    }
    .llm-chat-pending-badge {
      font-size: 12px;
      color: #f59e0b;
      background: rgba(245,158,11,0.1);
      padding: 4px 12px;
      border-radius: 12px;
    }

    /* Error */
    .llm-chat-error {
      margin: 0 16px;
      padding: 10px 14px;
      border-radius: 12px;
      background: ${d ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)'};
      border: 1px solid ${d ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .llm-chat-error-text {
      font-size: 13px;
      color: ${d ? '#f87171' : '#dc2626'};
      flex: 1;
    }
    .llm-chat-error-retry {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 8px;
      border: 1px solid ${d ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'};
      background: transparent;
      color: ${d ? '#f87171' : '#dc2626'};
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .llm-chat-error-retry:hover {
      background: ${d ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)'};
    }

    /* Loading overlay */
    .llm-chat-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex: 1;
      padding: 40px 20px;
    }
    .llm-chat-spinner {
      width: 28px;
      height: 28px;
      border: 2.5px solid ${d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: llm-spin 0.7s linear infinite;
    }
    .llm-chat-loading-text {
      font-size: 13px;
      color: ${d ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'};
    }

    /* Input area */
    .llm-chat-input-area {
      padding: 8px 12px 12px;
      border-top: 1px solid ${d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};
    }

    /* Animations */
    @keyframes llm-fadein {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes llm-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes llm-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes llm-spin {
      to { transform: rotate(360deg); }
    }
  `;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================================
// Chat Component
// ============================================================================

/**
 * We need access to useChat, but it's defined in the same module (index.tsx).
 * To avoid circular imports at the module level, we dynamically grab it
 * from the context at runtime. The Chat component must be used inside
 * an <LLMProvider>, which provides everything via useLLM().
 *
 * Instead, we re-implement a lightweight version that calls useLLM() directly
 * and manages chat state internally. This avoids any circular dependency.
 */

interface ChatMessageInternal {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function Chat({
  systemPrompt = 'You are a helpful assistant. Keep responses concise and clear.',
  placeholder = 'Type a message...',
  theme = 'dark',
  className,
  maxHeight = '600px',
  inputActions,
  onSend: onSendProp,
  onResponse,
  onError: onErrorProp,
  showHeader = true,
  showProgress = true,
  welcomeMessage = 'Send a message to start chatting',
}: ChatProps) {
  const { llm, isLoading, isReady, loadProgress, error, modelId, backend, reload } = useLLM();

  const [messages, setMessages] = useState<ChatMessageInternal[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Inject styles
  useEffect(() => {
    injectChatStyles(theme);
  }, [theme]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Generate response
  const generate = async (userContent: string, currentMessages: ChatMessageInternal[]) => {
    if (!llm || !isReady || isProcessingRef.current) return;
    isProcessingRef.current = true;

    const userMsg: ChatMessageInternal = { role: 'user', content: userContent };
    setMessages(prev => [...prev, userMsg]);

    const apiMessages: ChatMessageInternal[] = [];
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }
    apiMessages.push(...currentMessages, userMsg);

    setIsGenerating(true);
    setStreamingText('');
    abortRef.current = false;

    try {
      const response = await llm.stream(
        apiMessages,
        (_token: string, fullText: string) => {
          if (abortRef.current) return;
          setStreamingText(fullText);
        }
      );

      if (!abortRef.current) {
        const assistantMsg: ChatMessageInternal = { role: 'assistant', content: response };
        setMessages(prev => [...prev, assistantMsg]);
        setStreamingText('');
        onResponse?.(response);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onErrorProp?.(error);
    } finally {
      setIsGenerating(false);
      isProcessingRef.current = false;
    }
  };

  // Process pending message when model becomes ready
  useEffect(() => {
    if (isReady && pendingMessage && !isProcessingRef.current) {
      const msg = pendingMessage;
      setPendingMessage(null);
      generate(msg, messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pendingMessage]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setInput('');
    onSendProp?.(text);

    if (llm && isReady) {
      generate(text, messages);
    } else if (isLoading) {
      // Queue the message
      const userMsg: ChatMessageInternal = { role: 'user', content: text };
      setMessages(prev => [...prev, userMsg]);
      setPendingMessage(text);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    setIsGenerating(false);
    if (streamingText) {
      setMessages(prev => [...prev, { role: 'assistant', content: streamingText + '...' }]);
      setStreamingText('');
    }
  };

  // Status
  const statusDotClass = error
    ? 'llm-chat-dot llm-chat-dot--error'
    : isReady
      ? 'llm-chat-dot llm-chat-dot--ready'
      : 'llm-chat-dot llm-chat-dot--loading';

  const statusText = error
    ? 'Error'
    : isReady
      ? 'Ready'
      : isLoading
        ? 'Loading...'
        : 'Idle';

  return (
    <div
      className={`llm-chat${className ? ` ${className}` : ''}`}
      style={{ maxHeight, height: '100%' }}
    >
      {/* Header */}
      {showHeader && (
        <div className="llm-chat-header">
          <span className="llm-chat-header-model">
            {modelId ? modelId.split('/').pop()?.substring(0, 30) : 'No model'}
            {backend && <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>({backend})</span>}
          </span>
          <div className="llm-chat-header-status">
            <span className={statusDotClass} />
            <span>{statusText}</span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {showProgress && isLoading && loadProgress && (
        <div className="llm-chat-progress">
          <div className="llm-chat-progress-bar">
            <div
              className="llm-chat-progress-fill"
              style={{ width: `${Math.min(100, loadProgress.progress)}%` }}
            />
          </div>
          <div className="llm-chat-progress-text">{loadProgress.status}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="llm-chat-error">
          <span className="llm-chat-error-text">{error.message}</span>
          <button className="llm-chat-error-retry" onClick={reload}>
            <RetryIcon /> Retry
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="llm-chat-messages">
        {isLoading && messages.length === 0 && !error && (
          <div className="llm-chat-loading">
            <div className="llm-chat-spinner" />
            <div className="llm-chat-loading-text">
              {loadProgress?.status || 'Initializing model...'}
            </div>
          </div>
        )}

        {!isLoading && messages.length === 0 && !error && (
          <div className="llm-chat-welcome">{welcomeMessage}</div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'system') return null;
          return (
            <div key={i} className={`llm-chat-bubble llm-chat-bubble--${msg.role}`}>
              <div className="llm-chat-bubble-content">{msg.content}</div>
            </div>
          );
        })}

        {/* Streaming */}
        {streamingText && (
          <div className="llm-chat-bubble llm-chat-bubble--assistant llm-chat-streaming">
            <div className="llm-chat-bubble-content">
              {streamingText}
              <span className="llm-chat-cursor" />
            </div>
          </div>
        )}

        {/* Pending */}
        {pendingMessage !== null && (
          <div className="llm-chat-pending">
            <span className="llm-chat-pending-badge">⏳ Waiting for model to load...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="llm-chat-input-area">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          disabled={!isReady && !isLoading}
          isGenerating={isGenerating}
          placeholder={isLoading ? 'Type now, send when ready...' : placeholder}
          theme={theme}
          actions={inputActions}
        />
      </div>
    </div>
  );
}

export { Chat };
