/**
 * Core LLM functionality - Separated from index.ts to avoid circular dependencies
 * with React integration.
 *
 * @module local-llm/core
 */

// Re-export types
export type {
  Backend,
  Device,
  Quantization,
  LLMConfig,
  MessageRole,
  ChatMessage,
  StreamCallback,
  LoadProgress,
  LoadProgressCallback,
  GenerateOptions,
  LLMProvider as LLMProviderInterface,
  AttachOptions,
  BrowserCapabilities,
} from './types';

// Re-export detection utilities
export { checkWebGPU, checkWasm, detectCapabilities, logCapabilities } from './detect';

// Re-export backends
export {
  WebLLMProvider,
  createWebLLMProvider,
  DEFAULT_WEBLLM_MODEL,
  WEBLLM_MODELS,
} from './backends/webllm';

export {
  TransformersProvider,
  createTransformersProvider,
  DEFAULT_TRANSFORMERS_MODEL,
  TRANSFORMERS_MODELS,
} from './backends/transformers';

// Re-export helpers
export {
  createOutputStreamer,
  attachToElements,
  createChatUI,
  createLoadingIndicator,
} from './helpers';

// Import for internal use
import type {
  LLMConfig,
  ChatMessage,
  GenerateOptions,
  StreamCallback,
  AttachOptions,
} from './types';

import { detectCapabilities } from './detect';
import { WebLLMProvider, DEFAULT_WEBLLM_MODEL } from './backends/webllm';
import { TransformersProvider, DEFAULT_TRANSFORMERS_MODEL } from './backends/transformers';
import { attachToElements } from './helpers';

/**
 * Main LLM interface with simplified API
 */
export interface LocalLLM {
  /**
   * Whether the model is loaded and ready
   */
  readonly isReady: boolean;

  /**
   * The current model ID
   */
  readonly modelId: string | null;

  /**
   * The backend being used
   */
  readonly backend: 'webllm' | 'transformers';

  /**
   * Generate a chat response
   */
  chat(
    messages: ChatMessage[] | string,
    options?: GenerateOptions
  ): Promise<string>;

  /**
   * Generate with streaming output
   */
  stream(
    messages: ChatMessage[] | string,
    onToken: StreamCallback,
    options?: GenerateOptions
  ): Promise<string>;

  /**
   * Attach to input/output elements for automatic generation
   */
  attachToInput(
    inputSelector: string | HTMLInputElement | HTMLTextAreaElement,
    outputSelector: string | HTMLElement,
    options?: AttachOptions
  ): () => void;

  /**
   * Unload the model and free resources
   */
  unload(): Promise<void>;
}

/**
 * Normalize messages - convert string to ChatMessage array
 */
function normalizeMessages(
  input: ChatMessage[] | string,
  systemPrompt?: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else {
    messages.push(...input);
  }

  return messages;
}

/**
 * Create a LocalLLM instance
 *
 * @param config - Configuration options
 * @returns Promise that resolves to a LocalLLM instance once the model is loaded
 *
 * @example
 * ```typescript
 * // Simple usage with defaults
 * const llm = await createLLM();
 *
 * // With configuration
 * const llm = await createLLM({
 *   model: 'phi-3-mini',
 *   backend: 'webllm',
 *   systemPrompt: 'You are a helpful assistant.',
 *   onLoadProgress: (p) => console.log(p.progress)
 * });
 * ```
 */
export async function createLLM(config: LLMConfig = {}): Promise<LocalLLM> {
  const {
    backend: requestedBackend = 'auto',
    device = 'auto',
    quantization = 'q4',
    systemPrompt,
    onLoadProgress,
  } = config;

  // Detect capabilities
  const capabilities = await detectCapabilities();

  // Determine which backend to use
  let useBackend: 'webllm' | 'transformers';

  if (requestedBackend === 'auto') {
    useBackend = capabilities.webgpu ? 'webllm' : 'transformers';
  } else if (requestedBackend === 'webllm') {
    if (!capabilities.webgpu) {
      console.warn('[LocalLLM] WebLLM requested but WebGPU not available. Falling back to Transformers.js');
      useBackend = 'transformers';
    } else {
      useBackend = 'webllm';
    }
  } else {
    useBackend = 'transformers';
  }

  // Determine model
  const model = config.model ?? (
    useBackend === 'webllm' ? DEFAULT_WEBLLM_MODEL : DEFAULT_TRANSFORMERS_MODEL
  );

  console.log(`[LocalLLM] Using ${useBackend} backend with model: ${model}`);

  // Create provider
  let provider: WebLLMProvider | TransformersProvider;

  if (useBackend === 'webllm') {
    provider = new WebLLMProvider();
  } else {
    provider = new TransformersProvider({ device, quantization });
  }

  // Load model
  await provider.load(model, onLoadProgress);

  // Create LocalLLM instance
  const llm: LocalLLM = {
    get isReady() {
      return provider.isReady;
    },

    get modelId() {
      return provider.modelId;
    },

    get backend() {
      return useBackend;
    },

    async chat(messages, options) {
      const normalizedMessages = normalizeMessages(messages, systemPrompt);
      return provider.chat(normalizedMessages, options);
    },

    async stream(messages, onToken, options) {
      const normalizedMessages = normalizeMessages(messages, systemPrompt);
      return provider.stream(normalizedMessages, onToken, options);
    },

    attachToInput(inputSelector, outputSelector, options) {
      return attachToElements(
        inputSelector,
        outputSelector,
        async (input, onToken) => {
          const normalizedMessages = normalizeMessages(input, systemPrompt);
          return provider.stream(normalizedMessages, onToken);
        },
        options
      );
    },

    async unload() {
      await provider.unload();
    },
  };

  return llm;
}

/**
 * Quick helper to test if the current browser supports WebGPU
 */
export async function isWebGPUSupported(): Promise<boolean> {
  const caps = await detectCapabilities();
  return caps.webgpu;
}
