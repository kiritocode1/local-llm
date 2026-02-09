/**
 * Local LLM - Browser-based LLM inference library
 *
 * A simple, generalized library for interacting with LLMs directly in the browser.
 * Works in any codebase with WebGPU or WASM support.
 *
 * @example
 * ```typescript
 * import { createLLM } from '@blank-utils/llm';
 *
 * const llm = await createLLM({
 *   onLoadProgress: (p) => console.log(`Loading: ${p.progress}%`)
 * });
 *
 * // Streaming generation
 * await llm.stream('Tell me a joke', (token) => console.log(token));
 *
 * // Attach to DOM elements
 * llm.attachToInput('#input', '#output');
 * ```
 *
 * @module @blank-utils/llm
 */

// Re-export everything from core
export {
  // Types
  type Backend,
  type Device,
  type Quantization,
  type LLMConfig,
  type MessageRole,
  type ChatMessage,
  type StreamCallback,
  type LoadProgress,
  type LoadProgressCallback,
  type GenerateOptions,
  type LLMProviderInterface,
  type AttachOptions,
  type BrowserCapabilities,

  // Detection utilities
  checkWebGPU,
  checkWasm,
  detectCapabilities,
  logCapabilities,

  // Backends
  WebLLMProvider,
  createWebLLMProvider,
  DEFAULT_WEBLLM_MODEL,
  WEBLLM_MODELS,
  TransformersProvider,
  createTransformersProvider,
  DEFAULT_TRANSFORMERS_MODEL,
  TRANSFORMERS_MODELS,

  // Helpers
  createOutputStreamer,
  attachToElements,
  createChatUI,
  createLoadingIndicator,

  // Main API
  type LocalLLM,
  createLLM,
  isWebGPUSupported,
} from './core';

// Default export
export { createLLM as default } from './core';

// ============================================================================
// React Integration (tree-shakeable re-exports)
// ============================================================================
// These are re-exported for convenience but can also be imported directly from
// '@blank-utils/llm/react' for smaller bundle sizes when not using all features.

export {
  // Context & Provider
  LLMProvider,
  useLLM,

  // Hooks
  useChat,
  useStream,
  useCompletion,

  // Components
  LLMLoading,
  LLMReady,

  // Types
  type LLMContextValue,
  type LLMProviderProps,
  type UseChatOptions,
  type UseChatReturn,
  type UseStreamOptions,
  type UseStreamReturn,
  type UseCompletionOptions,
  type UseCompletionReturn,
  type LLMLoadingProps,
  type LLMReadyProps,
} from './react';
