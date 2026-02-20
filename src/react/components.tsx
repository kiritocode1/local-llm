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
  let cleanMarkdown = markdown;
  
  // Catch streaming cursor artifacts attached to language tags by some model handlers (e.g., '```python_', '```_', '```|', '```python█')
  cleanMarkdown = cleanMarkdown.replace(/```([a-zA-Z0-9+#-]*)[_|█▋]+[ \t]*(?:\n|$)/gi, '```$1\n');

  // Replace anything that is an abbreviated mermaid block opener with '```mermaid'
  // using (?:\n|$) so that we catch streaming chunks before the new line is typed.
  cleanMarkdown = cleanMarkdown.replace(/```[ \t]*(?:mer(?:m|ma|mai)?|mmd|graphviz)[ \t]*(?:\n|$)/gi, '```mermaid\n');
  
  // Catch cases where the model is actively streaming '```m' or '```me' at the very tail end of the output stream.
  cleanMarkdown = cleanMarkdown.replace(/```[ \t]*(?:m|me)[ \t]*$/gi, '```mermaid\n');
  
  // In some instances, the user model hallucinates simply opening a code block, then immediately typing `graph TD` inside without a language tag.
  // We can't automatically assume ANY unmarked code block is mermaid, but if it starts with common Mermaid DSL terms, we force it.
  cleanMarkdown = cleanMarkdown.replace(/```[ \t]*(?:\n|$)[ \t]*(graph(?: TB| TD| BT| RL| LR)|sequenceDiagram|classDiagram|stateDiagram|pie(?: title)?|flowchart|gantt|journey)/gi, '```mermaid\n$1');

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
  - IMPORTANT: You MUST specify a valid Mermaid diagram type immediately after the tag (e.g., \`graph TD\`, \`flowchart LR\`, \`sequenceDiagram\`, \`stateDiagram\`, \`classDiagram\`).
  - Do not invent ad-hoc pseudo-code formats. Use strict Mermaid syntax. Node definitions look like: \`A[Node Title] --> B(Other Title)\`.
  - For example:
    \`\`\`mermaid
    graph TD
      A[Start of testing] --> B{Is valid?}
      B -- Yes --> C[Continue]
      B -- No --> D[Error]
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
  h1: ({ children }: any) => <h1 className="text-2xl font-light uppercase tracking-tight mt-6 mb-4 text-white border-b border-white/30 pb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-light uppercase tracking-tight mt-6 mb-4 text-white border-b border-white/30 pb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-light uppercase tracking-tight mt-4 mb-3 text-white">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-light uppercase tracking-tight mt-4 mb-2 text-white">{children}</h4>,
  p: ({ children }: any) => <p className="leading-relaxed [&:not(:first-child)]:mt-4 text-white/80 text-sm font-light font-mono">{children}</p>,
  ul: ({ children }: any) => <ul className="my-4 ml-6 list-square [&>li]:mt-2 text-white/80 font-mono text-sm font-light">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-4 ml-6 list-decimal [&>li]:mt-2 text-white/80 font-mono text-sm font-light">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  blockquote: ({ children }: any) => <blockquote className="mt-4 border border-white/30 p-4 italic text-white/60 font-mono text-sm font-light bg-transparent">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} className="underline text-white hover:bg-white hover:text-black transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>,
  table: ({ children }: any) => <div className="my-4 w-full overflow-y-auto border border-white/30"><table className="w-full text-sm font-mono font-light text-white">{children}</table></div>,
  tr: ({ children }: any) => <tr className="m-0 border-b border-white/30 p-0 hover:bg-white/5">{children}</tr>,
  th: ({ children }: any) => <th className="border-r border-white/30 last:border-r-0 text-white/50 px-4 py-2 font-light uppercase text-left">{children}</th>,
  td: ({ children }: any) => <td className="border-r border-white/30 last:border-r-0 px-4 py-2 text-left text-white/80">{children}</td>,
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
    <div className="relative font-mono" ref={ref}>
      <button 
        type="button" 
        className="flex items-center gap-2 px-3 py-1.5 border border-white/30 bg-transparent text-white hover:bg-white hover:text-black text-xs font-light uppercase tracking-widest transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayModel}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-72 max-h-[300px] overflow-y-auto bg-black border border-white/30 z-50 p-2 scrollbar-none">
          <div className="px-3 py-2 text-[10px] font-light text-white/50 uppercase tracking-widest border-b border-white/10 mb-1">WebLLM</div>
          {Object.entries(WEBLLM_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={cn(
                "block w-full text-left px-3 py-2.5 text-xs font-light uppercase tracking-wider truncate transition-colors",
                currentModel === value 
                  ? "bg-white text-black" 
                  : "text-white hover:bg-white/10"
              )}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) && <span className="ml-2 px-1.5 py-0.5 border border-current text-[9px]">VISION</span>}
            </button>
          ))}
          
          <div className="px-3 py-2 text-[10px] font-light text-white/50 uppercase tracking-widest mt-4 border-b border-white/10 mb-1">Transformers.js</div>
          {Object.entries(TRANSFORMERS_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={cn(
                "block w-full text-left px-3 py-2.5 text-xs font-light uppercase tracking-wider truncate transition-colors",
                currentModel === value 
                  ? "bg-white text-black" 
                  : "text-white hover:bg-white/10"
              )}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) && <span className="ml-2 px-1.5 py-0.5 border border-current text-[9px]">VISION</span>}
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
      // Append user-defined system prompt to the baseline safety rules 
      // ensuring mermaid schema rules aren't lost when consumers overwrite `systemPrompt` prop
      const finalSystemPrompt = systemPrompt !== DEFAULT_SYSTEM_PROMPT 
        ? `${DEFAULT_SYSTEM_PROMPT}\n\nAdditional instructions:\n${systemPrompt}`
        : systemPrompt;
      apiMessages.push({ role: 'system', content: finalSystemPrompt });
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
    <div className={cn("flex flex-col bg-black text-white font-mono rounded-none overflow-hidden", className)} style={{ maxHeight, height: '100%' }}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-6 py-4 bg-black border-b border-white/30">
          {onModelChange ? (
            <ModelSelector 
              currentModel={modelId} 
              onSelect={onModelChange}
            />
          ) : (
             <div className="px-3 py-1.5 border border-white/30 flex items-center gap-3">
               <span className="text-xs font-light uppercase tracking-widest text-white">
                 {modelId?.split('/').pop()}
               </span>
               {modelId && isVisionModel(modelId) && (
                 <span className="px-1.5 py-0.5 border border-white/30 text-[9px] font-light uppercase tracking-widest text-white bg-transparent">VISION</span>
               )}
             </div>
          )}
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-light tracking-widest text-white uppercase opacity-70">
              {error ? 'ERR' : isReady ? 'RDY' : isLoading ? 'LOD' : 'IDL'}
            </span>
            <div className={cn(
              "w-2 h-2 rounded-none",
              error ? "bg-red-500" : isReady ? "bg-white" : "bg-white/30 animate-pulse"
            )} />
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {showProgress && isLoading && loadProgress && (
        <div className="px-6 py-4 border-b border-white/30 bg-black">
          <div className="flex justify-between items-center mb-2 font-mono uppercase tracking-widest text-[10px]">
            <span className="text-white/70 font-light truncate pr-4">{loadProgress.status}</span>
            <span className="font-light text-white/70">{Math.round(loadProgress.progress)}%</span>
          </div>
          <div className="h-1 w-full bg-white/10 rounded-none overflow-hidden relative">
            <div
              className="h-full bg-white transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, loadProgress.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mx-6 mt-6 p-4 border border-red-500/50 bg-red-500/10 rounded-none gap-4">
          <span className="text-[10px] text-red-500 font-light uppercase tracking-wider">{error.message}</span>
          <button 
            className="flex items-center gap-2 px-3 py-1.5 bg-transparent text-red-500 border border-red-500/50 hover:bg-red-500/20 transition-colors rounded-none text-[10px] font-light uppercase tracking-widest"
            onClick={reload}
          >
            <RotateCcw className="w-3 h-3" /> REBOOT
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {!isLoading && messages.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center mt-12 mb-8 p-8 border border-white/10">
            <div className="w-16 h-16 border border-white/30 mb-6 flex items-center justify-center text-xl font-light bg-transparent text-white/50">
              //
            </div>
            <h3 className="text-xl font-light uppercase tracking-widest text-white/70 mb-4">SYSTEM READY</h3>
            <p className="text-white/40 max-w-sm uppercase text-[10px] leading-relaxed tracking-widest font-light">
              [ MARKDOWN | MATH | MERMAID ] INITIALIZED. AWAITING INPUT.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col w-full">
            {msg.role === 'user' ? (
              <div className="bg-transparent text-white/50 px-4 py-4 border border-white/10 rounded-none w-full">
                <div className="mb-2 text-[10px] tracking-widest uppercase opacity-50">USER</div>
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {msg.images.map(img => (
                      <img key={img.id} src={img.dataUrl} className="w-24 h-24 object-cover border border-white/30" alt="attachment" />
                    ))}
                  </div>
                )}
                <div className="prose prose-base dark:prose-invert max-w-none font-mono">
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
              <div className="prose prose-base dark:prose-invert max-w-none px-4 py-4 w-full min-w-0 font-mono border border-white/10 bg-transparent mt-1">
                <div className="mb-2 text-[10px] tracking-widest uppercase opacity-50 text-white">SYSTEM</div>
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
          <div className="flex flex-col w-full mt-1">
            <div className="prose prose-base dark:prose-invert max-w-none px-4 py-4 w-full min-w-0 font-mono border border-white/10 bg-transparent">
              <div className="mb-2 text-[10px] tracking-widest uppercase opacity-50 text-white">SYSTEM</div>
              <Streamdown 
                plugins={{ code, mermaid, math }} 
                components={markdownComponents} 
                animated={true} 
                isAnimating={isGenerating}
                mermaid={mermaidOptions}
                controls={streamdownControls}
                parseMarkdownIntoBlocksFn={sanitizeMarkdownLanguageBlocks}
                caret="block"
              >
                {streamingText}
              </Streamdown>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black border-t border-white/30">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          disabled={!isReady && !isLoading}
          isGenerating={isGenerating}
          placeholder={isLoading ? 'MODEL IS LOADING...' : 'MESSAGE...'}
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
