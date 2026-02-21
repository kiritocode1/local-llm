/**
 * Local LLM - Browser-based LLM inference library
 * Shared TypeScript types and interfaces
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Supported backend engines
 */
export type Backend = 'webllm';

/**
 * Device to run inference on
 */
export type Device = 'webgpu' | 'wasm' | 'auto';

/**
 * Quantization options for model loading
 */
export type Quantization = 'q4' | 'q8' | 'fp16' | 'fp32';

import type { SupportedModel } from './models';
export type { SupportedModel };

/**
 * Configuration for creating an LLM instance
 */
export interface LLMConfig {
  /**
   * Model identifier. For WebLLM, use MLC model IDs.
   * Use WebLLM compatible model IDs.
   * @default 'Phi-3-mini-4k-instruct-q4f16_1-MLC' for WebLLM
   */
  model?: SupportedModel;

  /**
   * Which backend to use
   * @default 'auto' - Will prefer WebLLM if WebGPU available
   */
  backend?: Backend;

  /**
   * Device to run on
   * @default 'auto' - Prefers WebGPU, falls back to WASM
   */
  device?: Device;

  /**
   * Quantization level (transformers.js only)
   * @default 'q4'
   */
  quantization?: Quantization;

  /**
   * System prompt to use for all conversations
   */
  systemPrompt?: string;

  /**
   * Callback for model loading progress
   */
  onLoadProgress?: LoadProgressCallback;
}

// ============================================================================
// Message Types (OpenAI Compatible)
// ============================================================================

/**
 * Role in a chat conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * A single message in a chat conversation
 */
export interface ChatMessage {
  role: MessageRole;
  content: string | any[];
}

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Callback for streaming token output
 */
export type StreamCallback = (token: string, fullText: string) => void;

/**
 * Loading progress information
 */
export interface LoadProgress {
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status text */
  status: string;
  /** Bytes loaded (if available) */
  loaded?: number;
  /** Total bytes (if available) */
  total?: number;
}

/**
 * Callback for model loading progress
 */
export type LoadProgressCallback = (progress: LoadProgress) => void;

// ============================================================================
// Generation Options
// ============================================================================

/**
 * Options for text generation
 */
export interface GenerateOptions {
  /**
   * Temperature for sampling (0-2)
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   * @default 512
   */
  maxTokens?: number;

  /**
   * Top-p sampling
   * @default 0.95
   */
  topP?: number;

  /**
   * Stop sequences
   */
  stopSequences?: string[];
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Unified interface for LLM backends
 */
export interface LLMProvider {
  /**
   * Backend identifier
   */
  readonly backend: Backend;

  /**
   * Whether the model is loaded and ready
   */
  readonly isReady: boolean;

  /**
   * Current model ID
   */
  readonly modelId: string | null;

  /**
   * Load a model
   */
  load(modelId: string, onProgress?: LoadProgressCallback): Promise<void>;

  /**
   * Generate a response (non-streaming)
   */
  chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;

  /**
   * Generate a response with streaming
   */
  stream(
    messages: ChatMessage[],
    onToken: StreamCallback,
    options?: GenerateOptions
  ): Promise<string>;

  /**
   * Unload the model and free resources
   */
  unload(): Promise<void>;
}

// ============================================================================
// DOM Helper Types
// ============================================================================

/**
 * Options for attaching to an input element
 */
export interface AttachOptions {
  /**
   * Trigger generation on Enter key
   * @default true
   */
  triggerOnEnter?: boolean;

  /**
   * Clear input after sending
   * @default true
   */
  clearOnSend?: boolean;

  /**
   * Show loading indicator
   * @default true
   */
  showLoading?: boolean;

  /**
   * Custom loading text
   * @default 'Thinking...'
   */
  loadingText?: string;
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Browser capability information
 */
export interface BrowserCapabilities {
  /** WebGPU is available */
  webgpu: boolean;
  /** WebAssembly is available */
  wasm: boolean;
  /** Recommended backend based on capabilities */
  recommendedBackend: Backend;
  /** Recommended device based on capabilities */
  recommendedDevice: Device;
}
