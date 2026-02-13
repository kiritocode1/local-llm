/**
 * Chat — A complete, self-contained chat interface for @blank-utils/llm.
 * Drop inside <LLMProvider> and get a working chat UI in one line.
 *
 * Premium "Terminal Luxury" Aesthetic (Cherry Red Edition).
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
import { useLLM, type UseChatOptions, LLMProvider, type LLMProviderProps } from './index';
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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
      border: 1px solid ${d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'};
      background: ${d ? '#09090b' : '#ffffff'};
      overflow: hidden;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: ${d ? '#fafafa' : '#09090b'};
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    /* Header */
    .llm-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
      font-size: 13px;
      background: ${d ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};
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
      border: 1px solid transparent;
      color: ${d ? '#e5e5e5' : '#1a1a1a'};
      font-weight: 500;
      font-size: 13px;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .llm-chat-model-btn:hover {
      background: ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'};
    }
    .llm-chat-model-menu {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      width: 280px;
      max-height: 300px;
      overflow-y: auto;
      background: ${d ? '#18181b' : '#ffffff'};
      border: 1px solid ${d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
      z-index: 50;
      padding: 4px;
      animation: llm-fadein 0.1s ease-out;
    }
    .llm-chat-model-group {
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      color: ${d ? '#a1a1aa' : '#71717a'};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }
    .llm-chat-model-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 6px 8px;
      font-size: 13px;
      color: ${d ? '#e5e5e5' : '#1a1a1a'};
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .llm-chat-model-item:hover {
      background: ${d ? '#27272a' : '#f4f4f5'};
      color: ${d ? '#fb7185' : '#e11d48'};
    }
    .llm-chat-model-item--active {
      color: ${d ? '#fb7185' : '#e11d48'};
      background: ${d ? 'rgba(251,113,133,0.1)' : 'rgba(225,29,72,0.05)'};
    }

    /* Status */
    .llm-chat-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: ${d ? '#a1a1aa' : '#71717a'};
    }
    .llm-chat-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .llm-chat-dot--loading {
      background: #f59e0b;
      animation: llm-pulse 1.5s infinite;
    }
    .llm-chat-dot--ready {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16,185,129,0.3);
    }
    .llm-chat-dot--error {
      background: #ef4444;
    }

    /* Progress */
    .llm-chat-progress {
      padding: 0 16px 8px;
    }
    .llm-chat-progress-bar {
      height: 2px;
      background: ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
      overflow: hidden;
    }
    .llm-chat-progress-fill {
      height: 100%;
      background: ${d ? '#fb7185' : '#e11d48'};
      transition: width 0.3s ease;
    }
    .llm-chat-progress-text {
      font-size: 11px;
      color: ${d ? '#71717a' : '#a1a1aa'};
      margin-top: 4px;
      text-align: right;
    }

    /* Messages */
    .llm-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      scrollbar-width: thin;
    }
    
    /* Welcome */
    .llm-chat-welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      color: ${d ? '#52525b' : '#a1a1aa'};
      padding: 40px;
    }
    .llm-chat-welcome h3 {
      font-size: 16px;
      font-weight: 600;
      color: ${d ? '#e5e5e5' : '#1a1a1a'};
      margin: 0 0 8px;
    }
    .llm-chat-welcome p {
      font-size: 14px;
      margin: 0;
      max-width: 300px;
    }

    /* Bubble */
    .llm-chat-bubble {
      display: flex;
      flex-direction: column;
      max-width: 100%;
      animation: llm-fadein 0.2s ease;
    }
    .llm-chat-bubble--user {
      align-self: flex-end;
      max-width: 85%;
    }
    .llm-chat-bubble--assistant {
      align-self: flex-start;
      width: 100%;
    }
    
    /* User Message Style */
    .llm-chat-user-content {
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      background: ${d ? '#fb7185' : '#e11d48'}; /* Cherry Red */
      color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    /* Assistant Message Style (Streamdown wrapper) */
    .llm-chat-assistant-content {
      font-size: 14px;
      line-height: 1.7;
      color: ${d ? '#e5e5e5' : '#1a1a1a'};
    }
    
    /* Streamdown Overrides */
    .llm-chat-assistant-content pre {
      background: ${d ? '#18181b' : '#f4f4f5'} !important;
      border: 1px solid ${d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} !important;
      border-radius: 8px !important;
      padding: 12px !important;
      margin: 12px 0 !important;
    }
    .llm-chat-assistant-content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 13px !important;
    }
    .llm-chat-assistant-content :not(pre) > code {
      background: ${d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
      padding: 2px 4px;
      border-radius: 4px;
      color: ${d ? '#fb7185' : '#e11d48'};
    }
    
    /* Attachments in message */
    .llm-chat-msg-images {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      justify-content: flex-end;
    }
    .llm-chat-msg-img {
      width: 120px;
      height: 120px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid ${d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
    }

    /* Error */
    .llm-chat-error {
      margin: 0 16px;
      padding: 12px 16px;
      border-radius: 8px;
      background: ${d ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)'};
      border: 1px solid ${d ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
      border-radius: 6px;
      border: 1px solid ${d ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'};
      background: transparent;
      color: ${d ? '#f87171' : '#dc2626'};
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
    }

    /* Input Area */
    .llm-chat-input-area {
      padding: 12px 16px 16px;
      border-top: 1px solid ${d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};
      background: ${d ? '#09090b' : '#ffffff'};
    }

    @keyframes llm-fadein {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes llm-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
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

function ModelSelector({ 
  currentModel, 
  onSelect,
  theme
}: { 
  currentModel: string | null, 
  onSelect: (id: string) => void,
  theme: 'dark' | 'light'
}) {
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
    return id.length > 25 ? id.substring(0, 25) + '...' : id;
  }, [currentModel]);

  return (
    <div className="llm-chat-model-select" ref={ref}>
      <button 
        type="button" 
        className="llm-chat-model-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayModel} <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="llm-chat-model-menu">
          <div className="llm-chat-model-group">WebLLM Models (Standard)</div>
          {Object.entries(WEBLLM_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={`llm-chat-model-item ${currentModel === value ? 'llm-chat-model-item--active' : ''}`}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key}
            </button>
          ))}
          
          <div className="llm-chat-model-group">Transformers.js Models</div>
          {Object.entries(TRANSFORMERS_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={`llm-chat-model-item ${currentModel === value ? 'llm-chat-model-item--active' : ''}`}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key}
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
  welcomeMessage = 'Ready to assist. Type below to start.',
  onModelChange,
}: ChatProps) {
  const { llm, isLoading, isReady, loadProgress, error, modelId, reload } = useLLM();

  const [messages, setMessages] = useState<ChatMessageInternal[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null); // queue for when loading
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

    // Create user message
    const userMsg: ChatMessageInternal = { 
      role: 'user', 
      content: userContent,
      images: attachedImages 
    };
    
    // Add to UI immediately
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setStreamingText('');
    abortRef.current = false;

    // Build API messages
    const apiMessages: ChatMessage[] = [];
    
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add previous history
    currentMessages.forEach(m => {
      // Simplification: Not sending images to LLM yet (requires vision-specific handling)
      // Just sending text content for history context
      apiMessages.push({ role: m.role as ChatMessage['role'], content: m.content });
    });

    // Add current message
    // TODO: Vision support - construct content array if images present
    apiMessages.push({ role: 'user', content: userContent });

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
      
      // Add error message to chat
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
      // Queue logic... simplified for now (only text queue)
      // Ideally we'd queue images too but that's complex
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
               <span style={{fontWeight: 600}}>{modelId?.split('/').pop()}</span>
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
            <h3>{welcomeMessage}</h3>
            <p>I can help with coding, analysis, and writing. I support Markdown, Mermaid diagrams, and more.</p>
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
                <div className="llm-chat-user-content">{msg.content}</div>
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
}: ChatAppProps) {
  const [model, setModel] = useState(defaultModel);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    onModelChange?.(newModel);
  };

  return (
    <LLMProvider 
      // Force remount when model changes to ensure clean state
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
