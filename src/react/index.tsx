/**
 * React Integration for Local LLM
 *
 * Provides React context, hooks, and components for easy LLM integration.
 *
 * @example
 * ```tsx
 * import { LLMProvider, useChat } from 'local-llm/react';
 *
 * function App() {
 *   return (
 *     <LLMProvider model="qwen-2.5-0.5b">
 *       <ChatComponent />
 *     </LLMProvider>
 *   );
 * }
 *
 * function ChatComponent() {
 *   const { messages, send, isGenerating } = useChat();
 *
 *   return (
 *     <div>
 *       {messages.map((m, i) => <p key={i}>{m.content}</p>)}
 *       <button onClick={() => send('Hello!')}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
import * as React from 'react';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import type {
  LLMConfig,
  ChatMessage,
  GenerateOptions,
  LoadProgress,
  Backend,
} from '../types';

import { createLLM, type LocalLLM } from '../core';



// ============================================================================
// Context Types
// ============================================================================

export interface LLMContextValue {
  /** The LLM instance (null while loading) */
  llm: LocalLLM | null;

  /** Whether the model is currently loading */
  isLoading: boolean;

  /** Whether the model is ready for inference */
  isReady: boolean;

  /** Current loading progress */
  loadProgress: LoadProgress | null;

  /** Error if loading failed */
  error: Error | null;

  /** Current model ID */
  modelId: string | null;

  /** Backend being used */
  backend: Backend | null;

  /** Manually reload the model */
  reload: () => Promise<void>;

  /** Unload the model */
  unload: () => Promise<void>;
}

const LLMContext = createContext<LLMContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface LLMProviderProps extends Omit<LLMConfig, 'onLoadProgress'> {
  children: React.ReactNode;

  /**
   * Auto-load the model on mount
   * @default true
   */
  autoLoad?: boolean;

  /**
   * Callback when model finishes loading
   */
  onLoad?: (llm: LocalLLM) => void;

  /**
   * Callback on loading progress
   */
  onProgress?: (progress: LoadProgress) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

/**
 * Provider component that manages LLM lifecycle
 *
 * @example
 * ```tsx
 * <LLMProvider
 *   model="qwen-2.5-0.5b"
 *   backend="auto"
 *   onProgress={(p) => console.log(p.progress)}
 * >
 *   <App />
 * </LLMProvider>
 * ```
 */
function LLMProvider({
  children,
  autoLoad = true,
  onLoad,
  onProgress,
  onError,
  ...config
}: LLMProviderProps) {
  const [llm, setLLM] = useState<LocalLLM | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Track if we've loaded to prevent double-loading in StrictMode
  const hasLoadedRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  const load = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setLoadProgress({ progress: 0, status: 'Initializing...' });

    try {
      const instance = await createLLM({
        ...configRef.current,
        onLoadProgress: (progress) => {
          setLoadProgress(progress);
          onProgress?.(progress);
        },
      });

      setLLM(instance);
      setLoadProgress({ progress: 100, status: 'Ready' });
      onLoad?.(instance);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onLoad, onProgress, onError]);

  const unload = useCallback(async () => {
    if (llm) {
      await llm.unload();
      setLLM(null);
      setLoadProgress(null);
      hasLoadedRef.current = false;
    }
  }, [llm]);

  const reload = useCallback(async () => {
    await unload();
    await load();
  }, [unload, load]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && !hasLoadedRef.current && !llm && !isLoading) {
      hasLoadedRef.current = true;
      load();
    }
  }, [autoLoad, llm, isLoading, load]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (llm) {
        llm.unload().catch(console.error);
      }
    };
  }, [llm]);

  const value = useMemo<LLMContextValue>(
    () => ({
      llm,
      isLoading,
      isReady: llm?.isReady ?? false,
      loadProgress,
      error,
      modelId: llm?.modelId ?? null,
      backend: llm?.backend ?? null,
      reload,
      unload,
    }),
    [llm, isLoading, loadProgress, error, reload, unload]
  );

  return <LLMContext.Provider value={value}>{children}</LLMContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access the LLM context
 *
 * @throws If used outside of LLMProvider
 *
 * @example
 * ```tsx
 * const { llm, isReady, loadProgress } = useLLM();
 * ```
 */
function useLLM(): LLMContextValue {
  const context = useContext(LLMContext);

  if (!context) {
    throw new Error('useLLM must be used within an LLMProvider');
  }

  return context;
}

// ============================================================================
// useChat Hook
// ============================================================================

export interface UseChatOptions {
  /** Initial messages */
  initialMessages?: ChatMessage[];

  /** System prompt */
  systemPrompt?: string;

  /** Generation options */
  generateOptions?: GenerateOptions;

  /**
   * Queue messages while model is loading
   * When true, users can send messages before model loads - they'll be processed once ready
   * @default true
   */
  queueWhileLoading?: boolean;

  /** Called when generation starts */
  onStart?: () => void;

  /** Called on each token (streaming) */
  onToken?: (token: string, fullText: string) => void;

  /** Called when generation completes */
  onFinish?: (response: string) => void;

  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  /** All messages in the conversation */
  messages: ChatMessage[];

  /** Current input value (for controlled input) */
  input: string;

  /** Set the input value */
  setInput: (input: string) => void;

  /** Whether currently generating a response */
  isGenerating: boolean;

  /** Whether a message is queued waiting for model to load */
  isPending: boolean;

  /** Current streaming text (while generating) */
  streamingText: string;

  /** Send a message and get a response */
  send: (content?: string) => Promise<string>;

  /** Stop the current generation */
  stop: () => void;

  /** Clear all messages */
  clear: () => void;

  /** Add a message without generating a response */
  append: (message: ChatMessage) => void;

  /** Reload/regenerate the last assistant message */
  reload: () => Promise<string>;
}

/**
 * Hook for managing a chat conversation with the LLM
 * 
 * Supports **eager loading** - users can send messages while the model loads.
 * Messages are queued and processed automatically once the model is ready.
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { isLoading, loadProgress } = useLLM();
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     send,
 *     isGenerating,
 *     isPending,  // true if message is queued waiting for model
 *     streamingText,
 *   } = useChat({
 *     systemPrompt: 'You are a helpful assistant.',
 *     queueWhileLoading: true,  // default: true
 *   });
 *
 *   return (
 *     <div>
 *       {isLoading && <p>Loading model... {loadProgress?.progress}%</p>}
 *       
 *       {messages.map((m, i) => (
 *         <div key={i} className={m.role}>
 *           {m.content}
 *         </div>
 *       ))}
 *       
 *       {isPending && <p className="pending">Waiting for model to load...</p>}
 *       {isGenerating && <div className="assistant">{streamingText}</div>}
 *       
 *       {/* Users can type immediately, even before model loads *\/}
 *       <input
 *         value={input}
 *         onChange={(e) => setInput(e.target.value)}
 *         onKeyDown={(e) => e.key === 'Enter' && send()}
 *         placeholder={isLoading ? 'Type now, send when ready...' : 'Type a message...'}
 *       />
 *       <button onClick={() => send()} disabled={isGenerating}>
 *         {isPending ? 'Queued...' : 'Send'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { llm, isReady, isLoading } = useLLM();

  const {
    initialMessages = [],
    systemPrompt,
    generateOptions,
    queueWhileLoading = true,
    onStart,
    onToken,
    onFinish,
    onError,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  // Track pending message that's waiting for model to load
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const abortRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Internal function to actually generate a response
  const generateResponse = useCallback(
    async (userContent: string, currentMessages: ChatMessage[]): Promise<string> => {
      if (!llm || !isReady || isProcessingRef.current) {
        return '';
      }

      isProcessingRef.current = true;

      // Add user message
      const userMessage: ChatMessage = { role: 'user', content: userContent };
      setMessages((prev) => [...prev, userMessage]);

      // Build messages array for API
      const apiMessages: ChatMessage[] = [];

      if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt });
      }

      apiMessages.push(...currentMessages, userMessage);

      // Start generation
      setIsGenerating(true);
      setStreamingText('');
      abortRef.current = false;
      onStart?.();

      try {
        const response = await llm.stream(
          apiMessages,
          (token, fullText) => {
            if (abortRef.current) return;
            setStreamingText(fullText);
            onToken?.(token, fullText);
          },
          generateOptions
        );

        if (!abortRef.current) {
          // Add assistant message
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingText('');
          onFinish?.(response);
        }

        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
        return '';
      } finally {
        setIsGenerating(false);
        isProcessingRef.current = false;
      }
    },
    [llm, isReady, systemPrompt, generateOptions, onStart, onToken, onFinish, onError]
  );

  // Process pending message when model becomes ready
  useEffect(() => {
    if (isReady && pendingMessage && !isProcessingRef.current) {
      const messageToProcess = pendingMessage;
      setPendingMessage(null);
      generateResponse(messageToProcess, messages);
    }
  }, [isReady, pendingMessage, messages, generateResponse]);

  const send = useCallback(
    async (content?: string): Promise<string> => {
      const messageContent = content ?? input;

      if (!messageContent.trim()) {
        return '';
      }

      // Clear input if using controlled input
      if (!content) {
        setInput('');
      }

      // If model is ready, process immediately
      if (llm && isReady) {
        return generateResponse(messageContent, messages);
      }

      // If model is still loading and queueing is enabled, queue the message
      if (isLoading && queueWhileLoading) {
        // Show the user message immediately even though model isn't ready
        const userMessage: ChatMessage = { role: 'user', content: messageContent };
        setMessages((prev) => [...prev, userMessage]);
        setPendingMessage(messageContent);
        return '';
      }

      // Model not ready and not loading (error state or not initialized)
      return '';
    },
    [input, llm, isReady, isLoading, queueWhileLoading, messages, generateResponse]
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setPendingMessage(null);

    // If there was streaming text, save it as a partial message
    if (streamingText) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamingText + '...' },
      ]);
      setStreamingText('');
    }
  }, [streamingText]);

  const clear = useCallback(() => {
    setMessages(initialMessages);
    setStreamingText('');
    setInput('');
    setPendingMessage(null);
  }, [initialMessages]);

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const reload = useCallback(async (): Promise<string> => {
    if (messages.length === 0) return '';

    // Find the last user message
    const lastUserIndex = messages.findLastIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return '';

    // Remove messages from the last user message onwards
    const previousMessages = messages.slice(0, lastUserIndex);
    const lastUserMessage = messages[lastUserIndex];

    // Safety check (should never happen given lastUserIndex check)
    if (!lastUserMessage) return '';

    setMessages(previousMessages);

    // Re-send
    return send(lastUserMessage.content);
  }, [messages, send]);

  return {
    messages,
    input,
    setInput,
    isGenerating,
    isPending: pendingMessage !== null,
    streamingText,
    send,
    stop,
    clear,
    append,
    reload,
  };
}

// ============================================================================
// useStream Hook
// ============================================================================

export interface UseStreamOptions {
  /** Generation options */
  generateOptions?: GenerateOptions;

  /** Called on each token */
  onToken?: (token: string, fullText: string) => void;

  /** Called when complete */
  onFinish?: (response: string) => void;

  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseStreamReturn {
  /** Current streamed text */
  text: string;

  /** Whether currently streaming */
  isStreaming: boolean;

  /** Start streaming a response */
  stream: (messages: ChatMessage[] | string) => Promise<string>;

  /** Stop streaming */
  stop: () => void;

  /** Clear the text */
  clear: () => void;
}

/**
 * Hook for simple streaming generation
 *
 * @example
 * ```tsx
 * function StreamComponent() {
 *   const { text, isStreaming, stream, clear } = useStream();
 *
 *   return (
 *     <div>
 *       <pre>{text}</pre>
 *       <button onClick={() => stream('Tell me a story')} disabled={isStreaming}>
 *         Generate
 *       </button>
 *       <button onClick={clear}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 */
function useStream(options: UseStreamOptions = {}): UseStreamReturn {
  const { llm, isReady } = useLLM();
  const { generateOptions, onToken, onFinish, onError } = options;

  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef(false);

  const stream = useCallback(
    async (input: ChatMessage[] | string): Promise<string> => {
      if (!llm || !isReady) {
        return '';
      }

      setIsStreaming(true);
      setText('');
      abortRef.current = false;

      try {
        const response = await llm.stream(
          input,
          (token, fullText) => {
            if (abortRef.current) return;
            setText(fullText);
            onToken?.(token, fullText);
          },
          generateOptions
        );

        onFinish?.(response);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
        return '';
      } finally {
        setIsStreaming(false);
      }
    },
    [llm, isReady, generateOptions, onToken, onFinish, onError]
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setText('');
  }, []);

  return {
    text,
    isStreaming,
    stream,
    stop,
    clear,
  };
}

// ============================================================================
// useCompletion Hook (simple single-shot)
// ============================================================================

export interface UseCompletionOptions {
  /** Generation options */
  generateOptions?: GenerateOptions;
}

export interface UseCompletionReturn {
  /** Current completion text */
  completion: string;

  /** Whether currently generating */
  isLoading: boolean;

  /** Generate a completion (non-streaming) */
  complete: (prompt: string) => Promise<string>;

  /** Clear the completion */
  clear: () => void;
}

/**
 * Hook for simple non-streaming completion
 *
 * @example
 * ```tsx
 * function CompletionComponent() {
 *   const { completion, isLoading, complete } = useCompletion();
 *
 *   return (
 *     <div>
 *       <p>{completion}</p>
 *       <button onClick={() => complete('Summarize this')} disabled={isLoading}>
 *         Complete
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
function useCompletion(
  options: UseCompletionOptions = {}
): UseCompletionReturn {
  const { llm, isReady } = useLLM();
  const { generateOptions } = options;

  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const complete = useCallback(
    async (prompt: string): Promise<string> => {
      if (!llm || !isReady) {
        return '';
      }

      setIsLoading(true);

      try {
        const response = await llm.chat(prompt, generateOptions);
        setCompletion(response);
        return response;
      } catch (err) {
        console.error('[useCompletion] Error:', err);
        return '';
      } finally {
        setIsLoading(false);
      }
    },
    [llm, isReady, generateOptions]
  );

  const clear = useCallback(() => {
    setCompletion('');
  }, []);

  return {
    completion,
    isLoading,
    complete,
    clear,
  };
}

// ============================================================================
// Loading Component
// ============================================================================

export interface LLMLoadingProps {
  /** Custom loading UI */
  children?: React.ReactNode;

  /** Class name for the wrapper */
  className?: string;
}

/**
 * Component that shows loading state while LLM is loading
 *
 * @example
 * ```tsx
 * <LLMLoading>
 *   <p>Loading model...</p>
 * </LLMLoading>
 * ```
 */
function LLMLoading({ children, className }: LLMLoadingProps) {
  const { isLoading, loadProgress } = useLLM();

  if (!isLoading) return null;

  if (children) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      <p>Loading model... {loadProgress?.progress ?? 0}%</p>
      <p>{loadProgress?.status}</p>
    </div>
  );
}

// ============================================================================
// Ready Gate Component
// ============================================================================

export interface LLMReadyProps {
  /** Content to show when ready */
  children: React.ReactNode;

  /** Content to show while loading */
  fallback?: React.ReactNode;
}

/**
 * Component that only renders children when LLM is ready
 *
 * @example
 * ```tsx
 * <LLMReady fallback={<Loading />}>
 *   <ChatInterface />
 * </LLMReady>
 * ```
 */
function LLMReady({ children, fallback = null }: LLMReadyProps) {
  const { isReady, isLoading } = useLLM();

  if (isLoading || !isReady) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Import ready-made components
import { Chat, type ChatProps } from './components';
import { ChatInput, type ChatInputProps } from './chat-input';

export {
  // Provider & Context
  LLMProvider,
  useLLM,

  // Hooks
  useChat,
  useStream,
  useCompletion,

  // Conditional Components
  LLMLoading,
  LLMReady,

  // Ready-Made Components
  Chat,
  ChatInput,

  // Component Types
  type ChatProps,
  type ChatInputProps,
};
