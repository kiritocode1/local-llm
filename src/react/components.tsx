import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useLLM, type UseChatOptions, LLMProvider, type LLMProviderProps } from './core';
import { ChatInput, type ChatInputProps, type ImageAttachment } from './chat-input';
import { WEBLLM_MODELS, TRANSFORMERS_MODELS, type SupportedModel } from '../models';
import type { ChatMessage } from '../types';

import { RotateCcw, ChevronDown, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// @ts-ignore
import { Streamdown, parseMarkdownIntoBlocks } from 'streamdown';
import type { MermaidErrorComponentProps, BlockProps } from 'streamdown';
// @ts-ignore
import { code } from '@streamdown/code';
// @ts-ignore
import { mermaid } from '@streamdown/mermaid';
// @ts-ignore
import { math } from '@streamdown/math';

import 'katex/dist/katex.min.css';
import 'streamdown/styles.css';
import '../tailwind.css';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Intercept the default streamdown blocks hook to sanitize malformed languages into supported codes.
function sanitizeMarkdownLanguageBlocks(markdown: string) {
  // Regex designed to catch malformed mermaid language keys (like 'mer', 'merma', 'mermai')
  // and force it to resolve to the full 'mermaid' language flag.
  let cleanMarkdown = markdown;
  cleanMarkdown = cleanMarkdown.replace(/```(?:mer|merma|mermai|mmd)\n/gi, '```mermaid\n');
  return parseMarkdownIntoBlocks(cleanMarkdown);
}

const CustomMermaidError = ({ error, retry }: MermaidErrorComponentProps) => (
  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 my-4 font-sans">
    <div className="flex items-center gap-2">
      <span className="text-xl"><AlertCircle className="w-5 h-5 text-red-500" /></span>
      <p className="font-semibold text-red-500 text-sm">Failed to render Mermaid diagram</p>
    </div>
    <div className="mt-2 text-red-400/80 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
      {error}
    </div>
    <button
      onClick={retry}
      className="mt-3 rounded bg-red-500/20 px-3 py-1.5 text-red-500 text-xs font-medium hover:bg-red-500/30 transition-colors"
    >
      Try Again
    </button>
  </div>
);

const streamdownControls = {
  mermaid: {
    fullscreen: true,
    download: true,
    copy: true,
    panZoom: true,
  }
};

// ============================================================================
// Types
// ============================================================================

export interface ChatProps {
  systemPrompt?: string;
  placeholder?: string;
  theme?: 'dark' | 'light';
  className?: string;
  maxHeight?: string;
  chatOptions?: Omit<UseChatOptions, 'systemPrompt'>;
  inputActions?: React.ReactNode;
  onSend?: (message: string) => void;
  onResponse?: (response: string) => void;
  onError?: (error: Error) => void;
  showHeader?: boolean;
  showProgress?: boolean;
  welcomeMessage?: string;
  onModelChange?: (modelId: string) => void;
}

export interface ChatAppProps extends ChatProps {
  defaultModel?: SupportedModel;
  defaultBackend?: 'webllm' | 'transformers' | 'auto';
  autoLoad?: boolean;
}

interface ChatMessageInternal {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.
- You can use full Markdown (bold, italic, headers, lists).
- You can use Code Blocks with language syntax highlighting.
- You can use Mermaid diagrams to visualize structured data, processes, and architectures. 
  - IMPORTANT: ALWAYS use exactly \`\`\`mermaid as the language tag. NEVER use \`\`\`mer, \`\`\`mmd, etc. 
  - For example:
    \`\`\`mermaid
    graph TD
      A --> B
    \`\`\`
- You can use LaTeX math ($$ ... $$).`;

const ALL_MODELS = { ...WEBLLM_MODELS, ...TRANSFORMERS_MODELS };

function isVisionModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return lower.includes('vl') || lower.includes('vision') || lower.includes('moondream');
}

// ============================================================================
// Markdown Components Mapped to Tailwind
// ============================================================================

const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-3xl font-bold tracking-tight mt-6 mb-4 text-zinc-900 dark:text-zinc-100">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-2xl font-semibold tracking-tight mt-6 mb-4 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-xl font-semibold tracking-tight mt-6 mb-3 text-zinc-900 dark:text-zinc-100">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-lg font-semibold tracking-tight mt-4 mb-2 text-zinc-900 dark:text-zinc-100">{children}</h4>,
  p: ({ children }: any) => <p className="leading-7 [&:not(:first-child)]:mt-4 text-zinc-800 dark:text-zinc-300">{children}</p>,
  ul: ({ children }: any) => <ul className="my-4 ml-6 list-disc [&>li]:mt-2 text-zinc-800 dark:text-zinc-300">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-4 ml-6 list-decimal [&>li]:mt-2 text-zinc-800 dark:text-zinc-300">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  blockquote: ({ children }: any) => <blockquote className="mt-4 border-l-2 border-zinc-300 dark:border-zinc-700 pl-4 italic text-zinc-600 dark:text-zinc-400">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} className="font-medium text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer">{children}</a>,
  table: ({ children }: any) => <div className="my-4 w-full overflow-y-auto"><table className="w-full text-sm">{children}</table></div>,
  tr: ({ children }: any) => <tr className="m-0 border-t border-zinc-200 dark:border-zinc-800 p-0 even:bg-zinc-50 dark:even:bg-zinc-900/50">{children}</tr>,
  th: ({ children }: any) => <th className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-100 text-left [&[align=center]]:text-center [&[align=right]]:text-right">{children}</th>,
  td: ({ children }: any) => <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right text-zinc-700 dark:text-zinc-300">{children}</td>,
};

// ============================================================================
// Internal Components
// ============================================================================

function ModelSelector({ 
  currentModel, 
  onSelect,
}: { 
  currentModel: string | null, 
  onSelect: (id: string) => void,
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
    const id = currentModel.split('/').pop() || currentModel;
    let label = id.length > 25 ? id.substring(0, 25) + '...' : id;
    if (isVisionModel(currentModel)) {
      label += ' [VISION]';
    }
    return label;
  }, [currentModel]);

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button" 
        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium tracking-wide rounded-full transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayModel}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-72 max-h-[300px] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 py-2 scrollbar-thin">
          <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">WebLLM</div>
          {Object.entries(WEBLLM_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={cn(
                "block w-full text-left px-3 py-2 text-xs font-medium truncate transition-colors",
                currentModel === value 
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              )}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">VISION</span>}
            </button>
          ))}
          
          <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">Transformers.js</div>
          {Object.entries(TRANSFORMERS_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={cn(
                "block w-full text-left px-3 py-2 text-xs font-medium truncate transition-colors",
                currentModel === value 
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              )}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">VISION</span>}
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
  placeholder = 'Message...',
  theme = 'dark',
  className,
  maxHeight = '600px',
  inputActions,
  onSend: onSendProp,
  onResponse,
  onError: onErrorProp,
  showHeader = true,
  showProgress = true,
  welcomeMessage = 'How can I help you today?',
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

  const mermaidOptions = useMemo(() => ({
    errorComponent: CustomMermaidError,
    config: {
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      securityLevel: 'strict',
    }
  } as any), [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isGenerating]);

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
      if (m.role === 'user' && m.images && m.images.length > 0 && isVisionModel(modelId || '')) {
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
    if (attachedImages.length > 0 && isVisionModel(modelId || '')) {
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

  return (
    <div className={cn("flex flex-col bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm", className)} style={{ maxHeight, height: '100%' }}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/20 backdrop-blur-md">
          {onModelChange ? (
            <ModelSelector 
              currentModel={modelId} 
              onSelect={onModelChange}
            />
          ) : (
             <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center gap-2">
               <span className="text-xs font-semibold tracking-wide text-zinc-700 dark:text-zinc-300">
                 {modelId?.split('/').pop()}
               </span>
               {modelId && isVisionModel(modelId) && (
                 <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">VISION</span>
               )}
             </div>
          )}
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 capitalize">
              {error ? 'Error' : isReady ? 'Ready' : isLoading ? 'Loading' : 'Idle'}
            </span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              error ? "bg-red-500" : isReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-300 dark:bg-zinc-700 animate-pulse"
            )} />
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {showProgress && isLoading && loadProgress && (
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate pr-4">{loadProgress.status}</span>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{Math.round(loadProgress.progress)}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, loadProgress.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between mx-5 mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
          <span className="text-sm text-red-700 dark:text-red-400 font-medium">{error.message}</span>
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-black border border-red-200 dark:border-red-900 shadow-sm rounded-lg text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
            onClick={reload}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {!isLoading && messages.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 mt-12 mb-8 transition-opacity hover:opacity-100">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-2xl shadow-xl shadow-blue-500/20 mb-6 flex items-center justify-center transform rotate-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">{welcomeMessage}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
              Use Markdown, paste images (Ctrl+V), create Mermaid diagrams, and write math equations safely.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "self-end" : "self-start w-full")}>
            {msg.role === 'user' ? (
              <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-5 py-3.5 rounded-[24px] rounded-br-[8px] sm:px-6 shadow-sm border border-zinc-200 dark:border-zinc-700/50">
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 mt-1">
                    {msg.images.map(img => (
                      <img key={img.id} src={img.dataUrl} className="w-24 h-24 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm" alt="attachment" />
                    ))}
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown 
                    plugins={{ code, mermaid, math }} 
                    components={markdownComponents} 
                    animated={true} 
                    isAnimating={false}
                    mermaid={mermaidOptions}
                    controls={streamdownControls}
                    parseMarkdownIntoBlocksFn={sanitizeMarkdownLanguageBlocks}
                  >
                    {msg.content}
                  </Streamdown>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none px-2 w-full min-w-0">
                <Streamdown 
                  plugins={{ code, mermaid, math }} 
                  components={markdownComponents} 
                  animated={true} 
                  isAnimating={false}
                  mermaid={mermaidOptions}
                  controls={streamdownControls}
                  parseMarkdownIntoBlocksFn={sanitizeMarkdownLanguageBlocks}
                >
                  {msg.content}
                </Streamdown>
              </div>
            )}
          </div>
        ))}

        {streamingText && (
          <div className="flex flex-col self-start w-full max-w-[85%]">
            <div className="prose prose-sm dark:prose-invert max-w-none px-2 w-full min-w-0">
              <Streamdown 
                plugins={{ code, mermaid, math }} 
                components={markdownComponents} 
                animated={true} 
                isAnimating={isGenerating}
                mermaid={mermaidOptions}
                controls={streamdownControls}
                parseMarkdownIntoBlocksFn={sanitizeMarkdownLanguageBlocks}
              >
                {streamingText}
              </Streamdown>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-800/80">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          disabled={!isReady && !isLoading}
          isGenerating={isGenerating}
          placeholder={isLoading ? 'Model is loading...' : placeholder}
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
