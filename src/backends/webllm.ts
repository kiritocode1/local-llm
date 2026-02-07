/**
 * WebLLM Backend Implementation
 * Primary backend using MLC's WebLLM for high-performance inference
 */

import type {
  LLMProvider,
  ChatMessage,
  GenerateOptions,
  StreamCallback,
  LoadProgressCallback,
  LoadProgress,
  Backend,
} from '../types';

// WebLLM types (dynamic import)
type MLCEngine = import('@mlc-ai/web-llm').MLCEngine;
type CreateMLCEngine = typeof import('@mlc-ai/web-llm').CreateMLCEngine;

/**
 * Default model for WebLLM backend
 * Using Phi 3.5 Mini as it's well-tested and reasonably sized
 */
export const DEFAULT_WEBLLM_MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

/**
 * Popular WebLLM model options with correct MLC model IDs
 * These IDs must match exactly what's in web-llm's prebuiltAppConfig
 * 
 * @see https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
 */
export const WEBLLM_MODELS = {
  // === Llama 3.2 Models (Meta) - Excellent quality, reasonable size ===
  'llama-3.2-1b': 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'llama-3.2-3b': 'Llama-3.2-3B-Instruct-q4f16_1-MLC',

  // === Llama 3.1 Models (Meta) - Larger, higher quality ===
  'llama-3.1-8b': 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
  'llama-3.1-8b-1k': 'Llama-3.1-8B-Instruct-q4f16_1-MLC-1k', // Smaller context for lower memory

  // === Phi Models (Microsoft) - Great balance of size/quality ===
  'phi-3.5-mini': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'phi-3.5-mini-1k': 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k', // Smaller context for lower memory
  'phi-3.5-vision': 'Phi-3.5-vision-instruct-q4f16_1-MLC', // Vision model

  // === Qwen 2.5 Models (Alibaba) - Good multilingual support ===
  'qwen-2.5-0.5b': 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-1.5b': 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-3b': 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'qwen-2.5-7b': 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
  'qwen-2.5-coder-0.5b': 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-coder-1.5b': 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',

  // === Qwen 3 Models (Alibaba) - Latest generation ===
  'qwen-3-0.6b': 'Qwen3-0.6B-q4f16_1-MLC',
  'qwen-3-1.7b': 'Qwen3-1.7B-q4f16_1-MLC',
  'qwen-3-4b': 'Qwen3-4B-q4f16_1-MLC',
  'qwen-3-8b': 'Qwen3-8B-q4f16_1-MLC',

  // === Gemma 2 Models (Google) - Efficient and capable ===
  'gemma-2-2b': 'gemma-2-2b-it-q4f16_1-MLC',
  'gemma-2-2b-1k': 'gemma-2-2b-it-q4f16_1-MLC-1k', // Smaller context for lower memory
  'gemma-2-9b': 'gemma-2-9b-it-q4f16_1-MLC',

  // === SmolLM2 Models (HuggingFace) - Ultra lightweight ===
  'smollm2-135m': 'SmolLM2-135M-Instruct-q0f16-MLC',
  'smollm2-360m': 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  'smollm2-1.7b': 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',

  // === Mistral Models - Good general purpose ===
  'mistral-7b': 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',

  // === DeepSeek R1 Distill Models - Reasoning focused ===
  'deepseek-r1-qwen-7b': 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
  'deepseek-r1-llama-8b': 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',

  // === Hermes Models - Function calling capable ===
  'hermes-3-llama-3.2-3b': 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',
  'hermes-3-llama-3.1-8b': 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
} as const;

export type WebLLMModelAlias = keyof typeof WEBLLM_MODELS;

/**
 * Model size estimates for UI display
 */
export const WEBLLM_MODEL_SIZES: Record<WebLLMModelAlias, string> = {
  'llama-3.2-1b': '~880MB',
  'llama-3.2-3b': '~2.3GB',
  'llama-3.1-8b': '~5GB',
  'llama-3.1-8b-1k': '~4.6GB',
  'phi-3.5-mini': '~3.7GB',
  'phi-3.5-mini-1k': '~2.5GB',
  'phi-3.5-vision': '~4GB',
  'qwen-2.5-0.5b': '~945MB',
  'qwen-2.5-1.5b': '~1.6GB',
  'qwen-2.5-3b': '~2.5GB',
  'qwen-2.5-7b': '~5.1GB',
  'qwen-2.5-coder-0.5b': '~945MB',
  'qwen-2.5-coder-1.5b': '~1.6GB',
  'qwen-3-0.6b': '~1.4GB',
  'qwen-3-1.7b': '~2GB',
  'qwen-3-4b': '~3.4GB',
  'qwen-3-8b': '~5.7GB',
  'gemma-2-2b': '~1.9GB',
  'gemma-2-2b-1k': '~1.6GB',
  'gemma-2-9b': '~6.4GB',
  'smollm2-135m': '~360MB',
  'smollm2-360m': '~376MB',
  'smollm2-1.7b': '~1.8GB',
  'mistral-7b': '~4.6GB',
  'deepseek-r1-qwen-7b': '~5.1GB',
  'deepseek-r1-llama-8b': '~5GB',
  'hermes-3-llama-3.2-3b': '~2.3GB',
  'hermes-3-llama-3.1-8b': '~4.9GB',
};

/**
 * Resolve model alias to full MLC model ID
 */
function resolveModelId(model: string): string {
  if (model in WEBLLM_MODELS) {
    return WEBLLM_MODELS[model as WebLLMModelAlias];
  }
  return model;
}

/**
 * WebLLM provider implementation
 */
export class WebLLMProvider implements LLMProvider {
  readonly backend: Backend = 'webllm';

  private engine: MLCEngine | null = null;
  private currentModel: string | null = null;

  get isReady(): boolean {
    return this.engine !== null && this.currentModel !== null;
  }

  get modelId(): string | null {
    return this.currentModel;
  }

  async load(modelId: string, onProgress?: LoadProgressCallback): Promise<void> {
    const resolvedModel = resolveModelId(modelId);

    // Dynamic import to avoid bundling issues
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

    // Progress callback adapter
    const initProgressCallback = (report: { text: string; progress: number }) => {
      if (onProgress) {
        const progress: LoadProgress = {
          progress: Math.round(report.progress * 100),
          status: report.text,
        };
        onProgress(progress);
      }
    };

    this.engine = await CreateMLCEngine(resolvedModel, {
      initProgressCallback,
    });

    this.currentModel = resolvedModel;
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    if (!this.engine) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const response = await this.engine.chat.completions.create({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 512,
      top_p: options?.topP ?? 0.95,
      stop: options?.stopSequences,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async stream(
    messages: ChatMessage[],
    onToken: StreamCallback,
    options?: GenerateOptions
  ): Promise<string> {
    if (!this.engine) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const chunks = await this.engine.chat.completions.create({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 512,
      top_p: options?.topP ?? 0.95,
      stop: options?.stopSequences,
      stream: true,
    });

    let fullText = '';

    for await (const chunk of chunks) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        fullText += token;
        onToken(token, fullText);
      }
    }

    return fullText;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModel = null;
    }
  }
}

/**
 * Create a WebLLM provider instance
 */
export function createWebLLMProvider(): WebLLMProvider {
  return new WebLLMProvider();
}
