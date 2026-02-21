import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useLLM, type UseChatOptions, LLMProvider, type LLMProviderProps } from './core';
import { ChatInput, type ChatInputProps, type ImageAttachment } from './chat-input';
import { WEBLLM_MODELS, type SupportedModel } from '../models';
import type { ChatMessage, LoadProgress, GenerateOptions } from '../types';
import type { LocalLLM } from '../core';
import { createLLM } from '../core';

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

/**
 * Utility to hack around WebLLM's hardcoded image embedding size.
 * WebLLM v0.2.81 hardcodes `IMAGE_EMBED_SIZE = 1921`.
 * In Phi-3.5-vision, this exact token count is achieved ONLY when you evaluate to a 4:3 crop (h=3, w=4).
 * We resize and pad every image into a 1344x1008 canvas (which is 4 * 336-width and 3 * 336-height).
 */
async function resizeImageForWebLLM(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const TARGET_W = 1344;
      const TARGET_H = 1008;
      
      const canvas = document.createElement('canvas');
      canvas.width = TARGET_W;
      canvas.height = TARGET_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      // Fill with black padding 
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);

      // Letterbox the original image
      const scale = Math.min(TARGET_W / img.width, TARGET_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (TARGET_W - w) / 2;
      const y = (TARGET_H - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl); // fallback if fails
    img.src = dataUrl;
  });
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
  defaultBackend?: 'webllm';
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
- You can use LaTeX math ($$ ... $$).
- IF you are provided an uploaded image, your primary task is strictly to analyze the contents of that specific image in natural language. Do not hallucinate that the user desires a Mermaid diagram unless they specifically ask for one.`;

const ALL_MODELS = { ...WEBLLM_MODELS };

function isVisionModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return lower.includes('vl') || lower.includes('vision') || lower.includes('moondream');
}

// ============================================================================
// Markdown Components Mapped to Tailwind
// ============================================================================

const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-2xl font-light uppercase tracking-tight mt-6 mb-4 text-current border-b border-current/30 pb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-light uppercase tracking-tight mt-6 mb-4 text-current border-b border-current/30 pb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-light uppercase tracking-tight mt-4 mb-3 text-current">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-light uppercase tracking-tight mt-4 mb-2 text-current">{children}</h4>,
  p: ({ children }: any) => <p className="leading-relaxed [&:not(:first-child)]:mt-4 text-current/80 text-sm font-light font-mono">{children}</p>,
  ul: ({ children }: any) => <ul className="my-4 ml-6 list-square [&>li]:mt-2 text-current/80 font-mono text-sm font-light">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-4 ml-6 list-decimal [&>li]:mt-2 text-current/80 font-mono text-sm font-light">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  blockquote: ({ children }: any) => <blockquote className="mt-4 border border-current/30 p-4 italic text-current/60 font-mono text-sm font-light bg-transparent">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} className="underline text-current hover:opacity-70 transition-opacity" target="_blank" rel="noopener noreferrer">{children}</a>,
  table: ({ children }: any) => <div className="my-4 w-full overflow-y-auto border border-current/30"><table className="w-full text-sm font-mono font-light text-current">{children}</table></div>,
  tr: ({ children }: any) => <tr className="m-0 border-b border-current/30 p-0 hover:bg-current/5">{children}</tr>,
  th: ({ children }: any) => <th className="border-r border-current/30 last:border-r-0 text-current/50 px-4 py-2 font-light uppercase text-left">{children}</th>,
  td: ({ children }: any) => <td className="border-r border-current/30 last:border-r-0 px-4 py-2 text-left text-current/80">{children}</td>,
};

// ============================================================================
// Internal Components
// ============================================================================

function ModelSelector({ 
  currentModel, 
  onSelect,
  theme,
}: { 
  currentModel: string | null, 
  onSelect: (id: string) => void,
  theme: 'dark' | 'light',
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
        className="flex items-center gap-2 px-0 py-1.5 bg-transparent text-current hover:opacity-70 text-[11px] font-light uppercase tracking-widest transition-opacity"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>[ {displayModel} ]</span>
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-[calc(100%+8px)] left-0 w-72 max-h-[300px] overflow-y-auto border z-50 p-2 scrollbar-none",
          theme === 'dark' ? "bg-black border-white/20" : "bg-[#fafafa] border-black/20"
        )}>
          <div className="px-3 py-2 text-[10px] font-light text-current opacity-50 uppercase tracking-widest border-b border-current/10 mb-1">WebLLM</div>
          {Object.entries(WEBLLM_MODELS).map(([key, value]) => (
            <button
              key={key}
              className={cn(
                "block w-full text-left px-3 py-2.5 text-[11px] font-light uppercase tracking-widest truncate transition-colors text-current",
                currentModel === value 
                  ? (theme === 'dark' ? "bg-white text-black" : "bg-black text-white")
                  : "hover:opacity-60"
              )}
              onClick={() => { onSelect(value); setIsOpen(false); }}
            >
              {key} {isVisionModel(value) && <span className="ml-2 text-[9px] opacity-50">[VISION]</span>}
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

    for (const m of currentMessages) {
      let content: string | any[] = m.content;
      if (m.role === 'user' && m.images && m.images.length > 0 && isVisionModel(modelId || '')) {
        const processedImages = await Promise.all(
          m.images.map(img => resizeImageForWebLLM(img.dataUrl))
        );
        content = [
          { type: 'text', text: m.content },
          ...processedImages.map(url => ({ type: 'image_url', image_url: { url } }))
        ] as any[];
      }
      apiMessages.push({ role: m.role as ChatMessage['role'], content });
    }

    let finalUserContent: string | any[] = userContent;
    if (attachedImages.length > 0 && isVisionModel(modelId || '')) {
      const processedImages = await Promise.all(
        attachedImages.map(img => resizeImageForWebLLM(img.dataUrl))
      );
      finalUserContent = [
        { type: 'text', text: userContent },
        ...processedImages.map(url => ({ type: 'image_url', image_url: { url } }))
      ] as any[];
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text && images.length === 0) return;

    const currentImages = [...images];
    
    setInput('');
    setImages([]);
    abortRef.current = false;

    // Step 1: Execute in-browser image captioning only if it's NOT a vision model
    if (!isVisionModel(modelId || '')) {
       // Filter raster images (ignore SVG and PDFs since they're pre-extracted already)
       const needsCaptioning = currentImages.filter(img => !img.extractedText && !img.isSvg && !img.isPdf);
       
       if (needsCaptioning.length > 0) {
          setIsGenerating(true);
          setStreamingText('[System: Initializing detailed image-to-text captioning pipeline (Florence-2)...]\n');
          try {
             // Dynamically import transformers.js
             const { pipeline, env } = await import('@huggingface/transformers');
             env.allowLocalModels = false;
             env.useBrowserCache = true;
             
             // Use standard vit-gpt2 which is widely supported across all transformers.js versions
             const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', { device: 'wasm', dtype: 'q8' });
             
             for (let i = 0; i < needsCaptioning.length; i++) {
                if (abortRef.current) break;
                const img = needsCaptioning[i];
                if (!img) continue;
                setStreamingText(`[System: Extracting detailed visual description for ${img.name}... ${i+1}/${needsCaptioning.length}]\n`);
                
                // Pass generation config to encourage more detailed output compared to defaults
                const out = await captioner(img.dataUrl, {
                   max_new_tokens: 64,
                   num_beams: 4,
                   repetition_penalty: 1.5                
                } as any);
                
                let val = '';
                // @ts-ignore
                if (Array.isArray(out) && out[0] && out[0].generated_text) val = out[0].generated_text;
                // @ts-ignore
                else if (!Array.isArray(out) && out.generated_text) val = out.generated_text;
                
                img.extractedText = val;
             }
          } catch (err) {
             console.error('[ImagePipeline] Captioning error:', err);
             setStreamingText(`[System: Fallback captioning failed: ${err}]\n`);
          }
          if (abortRef.current) {
             setStreamingText('');
             setIsGenerating(false);
             return;
          }
          setStreamingText('');
          setIsGenerating(false);
       }
    }

    let finalText = text;
    for (const img of currentImages) {
      if (img.extractedText) {
        let prefix = '';
        if (img.isSvg) {
          prefix = `\n\n📄 SVG Source Code (${img.name}):\n`;
        } else if (!img.isPdf && !isVisionModel(modelId || '')) {
          prefix = `\n\n🖼️ System Image Representation (${img.name}) - [IMPORTANT SYSTEM INSTRUCTION: The user provided an image. Since you are a text model, here is an automated visual description of the image. DO NOT refuse the user's prompt. Answer as if you can see the image using this context:]\n`;
        }
        
        if (prefix || img.isPdf) {
           finalText += `${prefix}${img.isPdf ? '\n\n' : ''}${img.extractedText}`;
        }
      }
    }
    
    onSendProp?.(finalText);

    if (llm && isReady) {
      generate(finalText, messages, currentImages);
    } else if (isLoading) {
      setPendingMessage(finalText);
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

  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>(theme || 'dark');

  // Sync prop theme to local theme but allow independent overrides via toggle
  useEffect(() => {
    if (theme) setLocalTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setLocalTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={cn(
      "flex flex-col font-mono rounded-none overflow-hidden transition-colors duration-300",
      localTheme === 'dark' ? "bg-black text-[#fafafa] dark" : "bg-[#fafafa] text-black",
      className
    )} style={{ maxHeight, height: '100%' }}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-6 py-6 bg-transparent border-b border-current/10">
          <div className="flex items-center gap-6">
            <span className="text-[11px] font-light tracking-[0.2em] uppercase opacity-70">
              {error ? 'ERR' : isReady ? 'RDY' : isLoading ? 'LOD' : 'IDL'}
            </span>
            {onModelChange ? (
              <ModelSelector 
                currentModel={modelId} 
                onSelect={onModelChange}
                theme={localTheme}
              />
            ) : (
               <div className="flex items-center gap-2">
                 <span className="text-[11px] font-light uppercase tracking-[0.2em]">
                   [ {modelId?.split('/').pop()} ]
                 </span>
               </div>
            )}
          </div>
          
          <div className="flex items-center gap-6">
             <button 
               onClick={toggleTheme}
               className="text-[11px] tracking-[0.2em] uppercase font-light opacity-50 hover:opacity-100 transition-opacity"
             >
               [ {localTheme === 'dark' ? 'LIGHT' : 'DARK'} ]
             </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {showProgress && isLoading && loadProgress && (
        <div className="px-6 py-4 border-b border-current/10 bg-transparent">
          <div className="flex justify-between items-center mb-2 font-mono uppercase tracking-[0.2em] text-[10px]">
            <span className="opacity-50 font-light truncate pr-4">{loadProgress.status}</span>
            <span className="font-light opacity-50">{Math.round(loadProgress.progress)}%</span>
          </div>
          <div className="h-[1px] w-full bg-current/10 rounded-none overflow-hidden relative">
            <div
              className="h-full bg-current transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, loadProgress.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-6 md:mx-8 mt-6 p-6 border border-red-500/30 text-red-500 bg-red-500/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[10px] tracking-[0.2em] uppercase rounded-md">
          <span className="font-light leading-relaxed max-w-2xl">{error.message}</span>
          <button 
            onClick={reload} 
            className="group flex items-center justify-center min-w-max gap-3 px-6 py-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-300"
          >
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase">[ REBOOT ]</span>
            <span className="text-[10px] opacity-40 group-hover:opacity-60 transition-opacity tracking-widest">再起動</span>
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-12 scrollbar-none">
        {!isLoading && messages.length === 0 && !error && (
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <h3 className="text-sm font-light uppercase tracking-[0.3em] opacity-50 mb-4">SYSTEM READY</h3>
            <p className="opacity-30 max-w-sm uppercase text-[10px] leading-relaxed tracking-[0.2em] font-light">
              MARKDOWN INTERPRETER ACTIVE. AWAITING INPUT.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col w-full">
            {msg.role === 'user' ? (
              <div className="bg-transparent text-current py-2 w-full">
                <div className="mb-4 text-[10px] tracking-[0.2em] uppercase opacity-30">USER</div>
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {msg.images.map(img => (
                      <img key={img.id} src={img.dataUrl} className="w-24 h-24 object-cover border border-current/20 grayscale" alt="attachment" />
                    ))}
                  </div>
                )}
                <div className="prose prose-base dark:prose-invert max-w-none font-mono !text-current">
                  <Streamdown 
                    plugins={{ code, mermaid, math }} 
                    components={markdownComponents} 
                    animated={true} 
                    isAnimating={false}
                    mermaid={mermaidOptions}
                    controls={streamdownControls}
                    parseMarkdownIntoBlocksFn={sanitizeMarkdownLanguageBlocks}
                  >
                    {[
                      { match: "📄 PDF:", index: msg.content.indexOf("📄 PDF:") },
                      { match: "📄 SVG Source Code", index: msg.content.indexOf("📄 SVG Source Code") },
                      { match: "🖼️ System Image", index: msg.content.indexOf("🖼️ System Image") }
                    ]
                      .filter(m => m.index !== -1)
                      .reduce((min, m) => m.index < min ? m.index : min, msg.content.length) !== msg.content.length
                        ? msg.content.substring(0, [
                            { match: "📄 PDF:", index: msg.content.indexOf("📄 PDF:") },
                            { match: "📄 SVG Source Code", index: msg.content.indexOf("📄 SVG Source Code") },
                            { match: "🖼️ System Image", index: msg.content.indexOf("🖼️ System Image") }
                          ]
                            .filter(m => m.index !== -1)
                            .reduce((min, m) => m.index < min ? m.index : min, msg.content.length)).trim() 
                        : msg.content}
                  </Streamdown>
                </div>
              </div>
            ) : (
              <div className="prose prose-base dark:prose-invert max-w-none py-2 w-full min-w-0 font-mono bg-transparent mt-2 !text-current">
                <div className="mb-4 text-[10px] tracking-[0.2em] uppercase opacity-30 text-current">SYSTEM</div>
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
          <div className="flex flex-col w-full mt-2">
            <div className="prose prose-base dark:prose-invert max-w-none py-2 w-full min-w-0 font-mono bg-transparent !text-current">
              <div className="mb-4 text-[10px] tracking-[0.2em] uppercase opacity-30 text-current animate-pulse">SYSTEM GENERATING</div>
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
      <div className="p-6 bg-transparent">
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
          theme={localTheme}
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
  defaultBackend = 'webllm',
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
