/**
 * Chat — A complete, self-contained chat interface for @blank-utils/llm.
 * Drop inside <LLMProvider> and get a working chat UI in one line.
 *
 * Brutalist minimal aesthetic — flat black, high contrast, no decoration.
 *
 * @example
 * ```tsx
 * import { LLMProvider, Chat, ChatApp } from "@blank-utils/llm/react";
 *
 * // Option A: Zero setup (includes provider + model switching)
 * <ChatApp defaultModel="qwen-2.5-0.5b" />
 *
 * // Option B: Manual provider
 * <LLMProvider model="qwen-2.5-0.5b">
 *   <Chat />
 * </LLMProvider>
 * ```
 */

import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useLLM, type UseChatOptions, LLMProvider, type LLMProviderProps } from './core';
import { ChatInput, type ChatInputProps, type ImageAttachment } from './chat-input';
import { WEBLLM_MODELS, TRANSFORMERS_MODELS, type SupportedModel } from '../models';
import type { ChatMessage } from '../types';

// Streamdown imports (externalized in build)
// @ts-ignore
import { Streamdown } from 'streamdown';
// @ts-ignore
import { code } from '@streamdown/code';
// @ts-ignore
import { mermaid } from '@streamdown/mermaid';

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
  /** Called when the user selects a new model in the dropdown */
  onModelChange?: (modelId: string) => void;
}

export interface ChatAppProps extends ChatProps {
  /** Default model ID to start with */
  defaultModel?: SupportedModel;
  /** Default backend to use */
  defaultBackend?: 'webllm' | 'transformers' | 'auto';
  /** Auto-load model on mount. Default: true */
  autoLoad?: boolean;
}

// ============================================================================
// Internal Types & Utils
// ============================================================================

interface ChatMessageInternal {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.
- You can use full Markdown (bold, italic, headers, lists).
- You can use Code Blocks with language syntax highlighting.
- You can use Mermaid diagrams (\`\`\`mermaid ... \`\`\`).
- You can use LaTeX math ($$ ... $$).`;

const ALL_MODELS = { ...WEBLLM_MODELS, ...TRANSFORMERS_MODELS };

// ============================================================================
// Icons
// ============================================================================

function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ============================================================================
// Styles — Brutalist, flat, high-contrast. No shadows. No gradients.
//           No border-radius. Pure black. Monospace labels.
// ============================================================================

const STYLE_ID = '__llm-chat-styles';

function injectChatStyles(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const d = theme === 'dark';

  const bg = d ? '#000000' : '#ffffff';
  const border = d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const borderSubtle = d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const text = d ? '#ffffff' : '#000000';
  const textSecondary = d ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const textTertiary = d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const surfaceSubtle = d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const monoFont = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  const sansFont = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif`;

  const css = `
    .llm-chat {
      display: flex;
      flex-direction: column;
      border: 1px solid ${border};
      background: ${bg};
      overflow: hidden;
      font-family: ${sansFont};
      color: ${text};
    }

    /* Header */
    .llm-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid ${borderSubtle};
    }
    
    /* Model Selector */
    .llm-chat-model-select {
      position: relative;
    }
    .llm-chat-model-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: none;
      color: ${text};
      font-weight: 400;
      font-size: 11px;
      font-family: ${monoFont};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 0;
      cursor: pointer;
      transition: opacity 0.1s;
    }
    .llm-chat-model-btn:hover {
      opacity: 0.6;
    }
    .llm-chat-model-menu {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      width: 280px;
      max-height: 300px;
      overflow-y: auto;
      background: ${d ? '#0a0a0a' : '#fafafa'};
      border: 1px solid ${border};
      z-index: 50;
      padding: 4px 0;
      scrollbar-width: thin;
    }
    .llm-chat-model-group {
      padding: 8px 12px 4px;
      font-size: 10px;
      font-weight: 400;
      color: ${textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-family: ${monoFont};
    }
    .llm-chat-model-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 6px 12px;
      font-size: 12px;
      font-family: ${monoFont};
      color: ${textSecondary};
      background: transparent;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.1s;
    }
    .llm-chat-model-item:hover {
      color: ${text};
    }
    .llm-chat-model-item--active {
      color: ${text};
    }

    /* Status */
    .llm-chat-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      font-family: ${monoFont};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${textSecondary};
    }
    .llm-chat-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }
    .llm-chat-dot--loading {
      background: ${textSecondary};
      animation: llm-pulse 1.5s infinite;
    }
    .llm-chat-dot--ready {
      background: ${text};
    }
    .llm-chat-dot--error {
      background: #ff3333;
    }

    /* Progress */
    .llm-chat-progress {
      padding: 0 16px 8px;
    }
    .llm-chat-progress-bar {
      height: 1px;
      background: ${borderSubtle};
      overflow: hidden;
    }
    .llm-chat-progress-fill {
      height: 100%;
      background: ${text};
      transition: width 0.3s ease;
    }
    .llm-chat-progress-text {
      font-size: 10px;
      font-family: ${monoFont};
      color: ${textTertiary};
      margin-top: 4px;
      text-align: right;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Messages */
    .llm-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      scrollbar-width: thin;
    }
    
    /* Welcome */
    .llm-chat-welcome {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      flex: 1;
      color: ${textTertiary};
      padding: 40px 0;
    }
    .llm-chat-welcome h3 {
      font-size: 11px;
      font-weight: 400;
      font-family: ${monoFont};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${textSecondary};
      margin: 0 0 8px;
    }
    .llm-chat-welcome p {
      font-size: 13px;
      margin: 0;
      max-width: 360px;
      line-height: 1.6;
      color: ${textTertiary};
    }

    /* Bubble */
    .llm-chat-bubble {
      display: flex;
      flex-direction: column;
      max-width: 100%;
    }
    .llm-chat-bubble--user {
      align-self: flex-end;
      max-width: 80%;
      overflow-wrap: break-word;
    }
    .llm-chat-bubble--assistant {
      align-self: flex-start;
      width: 100%;
      min-width: 0; /* Prevents flex children from expanding past 100% */
      overflow-x: hidden;
    }
    
    /* User message — flat, subtle bg, no radius */
    .llm-chat-user-content {
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      background: ${surfaceSubtle};
      border: 1px solid ${borderSubtle};
      color: ${text};
    }
    
    /* Streamdown Overrides / Markdown Styling */
    .llm-chat-assistant-content {
      font-size: 14px;
      line-height: 1.7;
      color: ${text};
      word-wrap: break-word;
    }
    .llm-chat-assistant-content > *:first-child { margin-top: 0; }
    .llm-chat-assistant-content > *:last-child { margin-bottom: 0; }
    
    .llm-chat-assistant-content p {
      margin: 0 0 12px 0;
    }
    
    .llm-chat-assistant-content h1,
    .llm-chat-assistant-content h2,
    .llm-chat-assistant-content h3,
    .llm-chat-assistant-content h4 {
      margin: 20px 0 10px 0;
      color: ${text};
      font-weight: 600;
      line-height: 1.3;
    }
    .llm-chat-assistant-content h1 { font-size: 1.5em; }
    .llm-chat-assistant-content h2 { font-size: 1.3em; }
    .llm-chat-assistant-content h3 { font-size: 1.1em; }
    
    .llm-chat-assistant-content ul,
    .llm-chat-assistant-content ol {
      margin: 0 0 12px 0;
      padding-left: 24px;
    }
    .llm-chat-assistant-content li {
      margin-bottom: 4px;
    }
    
    .llm-chat-assistant-content pre {
      background: ${surfaceSubtle} !important;
      border: 1px solid ${borderSubtle} !important;
      border-radius: 6px !important;
      padding: 12px !important;
      margin: 12px 0 !important;
      overflow-x: auto !important;
      white-space: pre !important;
      max-width: 100%;
    }
    .llm-chat-assistant-content code {
      font-family: ${monoFont} !important;
      font-size: 13px !important;
      white-space: inherit;
    }
    .llm-chat-assistant-content :not(pre) > code {
      background: ${surfaceSubtle};
      border: 1px solid ${borderSubtle};
      border-radius: 4px;
      padding: 2px 5px;
      font-size: 12.5px !important;
      white-space: pre-wrap !important;
      word-break: break-word;
    }
    
    .llm-chat-assistant-content blockquote {
      border-left: 3px solid ${borderSubtle};
      margin: 0 0 12px 0;
      padding-left: 12px;
      color: ${textTertiary};
    }
    
    .llm-chat-assistant-content a {
      color: #3b82f6;
      text-decoration: none;
    }
    .llm-chat-assistant-content a:hover {
      text-decoration: underline;
    }
    
    .llm-chat-assistant-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    .llm-chat-assistant-content th,
    .llm-chat-assistant-content td {
      border: 1px solid ${borderSubtle};
      padding: 6px 10px;
      text-align: left;
    }
    .llm-chat-assistant-content th {
      background: ${surfaceSubtle};
      font-weight: 600;
    }
    
    /* Attachments in message */
    .llm-chat-msg-images {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
      justify-content: flex-end;
    }
    .llm-chat-msg-img {
      width: 100px;
      height: 100px;
      object-fit: cover;
      border: 1px solid ${border};
    }

    /* Error */
    .llm-chat-error {
      margin: 0 16px;
      padding: 10px 14px;
      border: 1px solid ${d ? 'rgba(255,50,50,0.2)' : 'rgba(200,0,0,0.15)'};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .llm-chat-error-text {
      font-size: 12px;
      font-family: ${monoFont};
      color: ${d ? '#ff6666' : '#cc0000'};
      flex: 1;
    }
    .llm-chat-error-retry {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: 1px solid ${d ? 'rgba(255,50,50,0.3)' : 'rgba(200,0,0,0.2)'};
      background: transparent;
      color: ${d ? '#ff6666' : '#cc0000'};
      font-size: 11px;
      font-family: ${monoFont};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
    }
    .llm-chat-error-retry:hover {
      background: ${d ? 'rgba(255,50,50,0.08)' : 'rgba(200,0,0,0.04)'};
    }

    /* Input Area */
    .llm-chat-input-area {
      padding: 12px 16px 16px;
      border-top: 1px solid ${borderSubtle};
    }

    @keyframes llm-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.2; }
    }
  `;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================================
// Internal Components
// ============================================================================

function isVisionModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return lower.includes('vl') || lower.includes('vision') || lower.includes('moondream');
}

function ModelSelector({ 
  currentModel, 
  onSelect,
  theme
}: { 
  currentModel: string | null, 
  onSelect: (id: string) => void,
  theme: 'dark' | 'light'
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayModel = useMemo(() => {
    if (!currentModel) return 'Select Model';
    // Find friendly name or format ID
    const id = currentModel.split('/').pop() || currentModel;
    let label = id.length > 25 ? id.substring(0, 25) + '...' : id;
    if (isVisionModel(currentModel)) {
      label += ' [VISION]';
    }
    return label;
  }, [currentModel]);

  return (
    <div className="llm-chat-model-select" ref={ref}>
      <button 
        type="button" 
        className="llm-chat-model-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        [{displayModel}] <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="llm-chat-model-menu">
          <div className="llm-chat-model-group">[WebLLM]</div>
          {Object.entries(WEBLLM_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={`llm-chat-model-item ${currentModel === value ? 'llm-chat-model-item--active' : ''}`}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) ? ' [VISION]' : ''}
            </button>
          ))}
          
          <div className="llm-chat-model-group">[Transformers.js]</div>
          {Object.entries(TRANSFORMERS_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={`llm-chat-model-item ${currentModel === value ? 'llm-chat-model-item--active' : ''}`}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) ? ' [VISION]' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Components
// ============================================================================

function Chat({
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
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
  welcomeMessage = 'Ready to assist',
  onModelChange,
}: ChatProps): React.JSX.Element {
  const { llm, isLoading, isReady, loadProgress, error, modelId, reload } = useLLM();

  const [messages, setMessages] = useState<ChatMessageInternal[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);

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
  }, [messages, streamingText, isGenerating]);

  // Generate response
  const generate = async (userContent: string, currentMessages: ChatMessageInternal[], attachedImages: ImageAttachment[] = []) => {
    if (!llm || !isReady || isProcessingRef.current) return;
    isProcessingRef.current = true;

    const userMsg: ChatMessageInternal = { 
      role: 'user', 
      content: userContent,
      images: attachedImages 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setStreamingText('');
    abortRef.current = false;

    const apiMessages: ChatMessage[] = [];
    
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }

    currentMessages.forEach(m => {
      let content: string | any[] = m.content;
      if (m.role === 'user' && m.images && m.images.length > 0) {
        if (llm.backend === 'webllm') {
          content = [
            { type: 'text', text: m.content },
            ...m.images.map(img => ({ type: 'image_url', image_url: { url: img.dataUrl } }))
          ] as any[];
        } else {
          content = [
            ...m.images.map(img => ({ type: 'image', image: img.dataUrl })),
            { type: 'text', text: m.content }
          ] as any[];
        }
      }
      apiMessages.push({ role: m.role as ChatMessage['role'], content });
    });

    let finalUserContent: string | any[] = userContent;
    if (attachedImages.length > 0) {
      if (llm.backend === 'webllm') {
        finalUserContent = [
          { type: 'text', text: userContent },
          ...attachedImages.map(img => ({ type: 'image_url', image_url: { url: img.dataUrl } }))
        ] as any[];
      } else {
        finalUserContent = [
          ...attachedImages.map(img => ({ type: 'image', image: img.dataUrl })),
          { type: 'text', text: userContent }
        ] as any[];
      }
    }

    apiMessages.push({ role: 'user', content: finalUserContent });

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
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error.message}` 
      }]);
    } finally {
      setIsGenerating(false);
      isProcessingRef.current = false;
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text && images.length === 0) return;

    const currentImages = [...images];
    
    setInput('');
    setImages([]);
    onSendProp?.(text);

    if (llm && isReady) {
      generate(text, messages, currentImages);
    } else if (isLoading) {
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
        ? 'Loading'
        : 'Idle';

  return (
    <div className={`llm-chat${className ? ` ${className}` : ''}`} style={{ maxHeight, height: '100%' }}>
      {/* Header */}
      {showHeader && (
        <div className="llm-chat-header">
          {onModelChange ? (
            <ModelSelector 
              currentModel={modelId} 
              onSelect={onModelChange}
              theme={theme}
            />
          ) : (
             <div className="llm-chat-model-select">
               <span style={{
                 fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                 fontSize: '11px',
                 textTransform: 'uppercase' as const,
                 letterSpacing: '0.05em',
               }}>
                 [{modelId?.split('/').pop()}] {modelId && isVisionModel(modelId) ? '[VISION]' : ''}
               </span>
             </div>
          )}
          
          <div className="llm-chat-status">
            <span>{statusText}</span>
            <div className={statusDotClass} />
          </div>
        </div>
      )}

      {/* Progress Bar */}
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

      {/* Error Banner */}
      {error && (
        <div className="llm-chat-error">
          <span className="llm-chat-error-text">{error.message}</span>
          <button className="llm-chat-error-retry" onClick={reload}>
            <RetryIcon /> Retry
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="llm-chat-messages">
        {!isLoading && messages.length === 0 && !error && (
          <div className="llm-chat-welcome">
            <h3>[{welcomeMessage}]</h3>
            <p>Markdown, code blocks, Mermaid diagrams. Paste images with Ctrl+V.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`llm-chat-bubble llm-chat-bubble--${msg.role}`}>
            {msg.role === 'user' ? (
              <>
                {msg.images && msg.images.length > 0 && (
                  <div className="llm-chat-msg-images">
                    {msg.images.map(img => (
                      <img key={img.id} src={img.dataUrl} className="llm-chat-msg-img" alt="attachment" />
                    ))}
                  </div>
                )}
                <div className="llm-chat-user-content" style={{ padding: '0px' }}>
                  <div className="llm-chat-assistant-content" style={{ padding: '10px 14px' }}>
                    <Streamdown plugins={{ code, mermaid }}>
                      {msg.content}
                    </Streamdown>
                  </div>
                </div>
              </>
            ) : (
              <div className="llm-chat-assistant-content">
                <Streamdown 
                  plugins={{ code, mermaid }}
                >
                  {msg.content}
                </Streamdown>
              </div>
            )}
            
          </div>
        ))}

        {streamingText && (
          <div className="llm-chat-bubble llm-chat-bubble--assistant">
            <div className="llm-chat-assistant-content">
                <Streamdown 
                  plugins={{ code, mermaid }}
                >
                  {streamingText}
                </Streamdown>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="llm-chat-input-area">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          disabled={!isReady && !isLoading}
          isGenerating={isGenerating}
          placeholder={isLoading ? 'Model is loading...' : placeholder}
          theme={theme}
          actions={inputActions}
          images={images}
          onImageAdd={img => setImages(prev => [...prev, img])}
          onImageRemove={id => setImages(prev => prev.filter(img => img.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// ChatApp Component
// ============================================================================

function ChatApp({
  defaultModel = 'qwen-2.5-0.5b',
  defaultBackend = 'auto',
  autoLoad = true,
  onModelChange,
  ...chatProps
}: ChatAppProps): React.JSX.Element {
  const [model, setModel] = useState(defaultModel);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    onModelChange?.(newModel);
  };

  return (
    <LLMProvider 
      key={model} 
      model={model as SupportedModel} 
      backend={defaultBackend}
      autoLoad={autoLoad}
    >
      <Chat 
        {...chatProps}
        onModelChange={handleModelChange}
      />
    </LLMProvider>
  );
}

export { Chat, ChatApp };
