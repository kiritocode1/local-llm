/**
 * Transformers.js Backend Implementation
 * Fallback backend using HuggingFace Transformers.js
 */

import type {
  LLMProvider,
  ChatMessage,
  GenerateOptions,
  StreamCallback,
  LoadProgressCallback,
  LoadProgress,
  Backend,
  Device,
  Quantization,
} from '../types';

// Import the specific pipeline type we need
import type { TextGenerationPipeline } from '@huggingface/transformers';

/**
 * Default model for Transformers.js backend
 */
export const DEFAULT_TRANSFORMERS_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

/**
 * Popular Transformers.js model options
 */
export const TRANSFORMERS_MODELS = {
  // Qwen models - Good for text generation, ONNX optimized
  'qwen-0.5b': 'onnx-community/Qwen2.5-0.5B-Instruct',
  'qwen-1.5b': 'onnx-community/Qwen2.5-1.5B-Instruct',

  // Phi models
  'phi-3-mini': 'Xenova/Phi-3-mini-4k-instruct',

  // TinyLlama - Very fast
  'tinyllama': 'Xenova/TinyLlama-1.1B-Chat-v1.0',

  // SmolLM - Ultra small
  'smollm-135m': 'HuggingFaceTB/SmolLM-135M-Instruct',
  'smollm-360m': 'HuggingFaceTB/SmolLM-360M-Instruct',
} as const;

export type TransformersModelAlias = keyof typeof TRANSFORMERS_MODELS;

/**
 * Resolve model alias to full HuggingFace model ID
 */
function resolveModelId(model: string): string {
  if (model in TRANSFORMERS_MODELS) {
    return TRANSFORMERS_MODELS[model as TransformersModelAlias];
  }
  return model;
}

/**
 * Format messages into a prompt string for text generation
 */
function formatPrompt(messages: ChatMessage[]): string {
  // Use ChatML-style formatting
  let prompt = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `<|im_start|>system\n${msg.content}<|im_end|>\n`;
    } else if (msg.role === 'user') {
      prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`;
    }
  }

  // Add assistant prefix for generation
  prompt += '<|im_start|>assistant\n';

  return prompt;
}

/**
 * Configuration for Transformers.js provider
 */
export interface TransformersProviderConfig {
  device?: Device;
  quantization?: Quantization;
}

/**
 * Transformers.js provider implementation
 */
export class TransformersProvider implements LLMProvider {
  readonly backend: Backend = 'transformers';

  private generator: TextGenerationPipeline | null = null;
  private currentModel: string | null = null;
  private config: TransformersProviderConfig;

  constructor(config: TransformersProviderConfig = {}) {
    this.config = config;
  }

  get isReady(): boolean {
    return this.generator !== null && this.currentModel !== null;
  }

  get modelId(): string | null {
    return this.currentModel;
  }

  async load(modelId: string, onProgress?: LoadProgressCallback): Promise<void> {
    const resolvedModel = resolveModelId(modelId);

    // Dynamic import
    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure cache directory (browser uses IndexedDB)
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // Determine device
    let device: 'webgpu' | 'wasm' = 'wasm';
    if (this.config.device === 'webgpu' || this.config.device === 'auto') {
      // Check if WebGPU is available
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
          }
        } catch {
          // Fall back to WASM
        }
      }
    }

    // Map quantization to dtype
    type TransformersDtype = 'auto' | 'q4' | 'q8' | 'fp16' | 'fp32' | 'int8' | 'uint8' | 'bnb4' | 'q4f16';
    const dtypeMap: Record<Quantization, TransformersDtype> = {
      q4: 'q4',
      q8: 'q8',
      fp16: 'fp16',
      fp32: 'fp32',
    };

    const dtype: TransformersDtype = dtypeMap[this.config.quantization ?? 'q4'];

    // Progress tracking
    let lastProgress = 0;
    const progressCallback = (event: { status: string; progress?: number; file?: string }) => {
      if (onProgress) {
        const progress = event.progress ?? lastProgress;
        lastProgress = progress;

        onProgress({
          progress: Math.round(progress),
          status: event.status,
        });
      }
    };

    // Create text generation pipeline
    // Type assertion needed because pipeline() has complex overloads that TypeScript can't resolve
    // The entire call is cast through `any` to avoid "union type too complex" errors
    this.generator = (await (pipeline as any)(
      'text-generation',
      resolvedModel,
      {
        device,
        dtype,
        progress_callback: progressCallback,
      }
    )) as TextGenerationPipeline;

    this.currentModel = resolvedModel;
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    if (!this.generator) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const prompt = formatPrompt(messages);

    const result = await this.generator(prompt, {
      max_new_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 0.95,
      do_sample: true,
      return_full_text: false,
    });

    // Extract generated text
    const output = Array.isArray(result) ? result[0] : result;
    let text = (output as { generated_text: string }).generated_text ?? '';

    // Clean up any trailing tokens
    const endToken = '<|im_end|>';
    const endIdx = text.indexOf(endToken);
    if (endIdx !== -1) {
      text = text.substring(0, endIdx);
    }

    return text.trim();
  }

  async stream(
    messages: ChatMessage[],
    onToken: StreamCallback,
    options?: GenerateOptions
  ): Promise<string> {
    if (!this.generator) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const prompt = formatPrompt(messages);

    // Transformers.js v3 supports streaming via TextStreamer
    // For now, we'll simulate streaming by generating in chunks
    // TODO: Use proper streaming when stable

    const result = await this.generator(prompt, {
      max_new_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 0.95,
      do_sample: true,
      return_full_text: false,
    });

    const output = Array.isArray(result) ? result[0] : result;
    let text = (output as { generated_text: string }).generated_text ?? '';

    // Clean up
    const endToken = '<|im_end|>';
    const endIdx = text.indexOf(endToken);
    if (endIdx !== -1) {
      text = text.substring(0, endIdx);
    }
    text = text.trim();

    // Simulate streaming by emitting tokens
    const words = text.split(/(\s+)/);
    let fullText = '';

    for (const word of words) {
      fullText += word;
      onToken(word, fullText);
      // Small delay for visual effect
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return fullText;
  }

  async unload(): Promise<void> {
    this.generator = null;
    this.currentModel = null;
  }
}

/**
 * Create a Transformers.js provider instance
 */
export function createTransformersProvider(
  config?: TransformersProviderConfig
): TransformersProvider {
  return new TransformersProvider(config);
}
