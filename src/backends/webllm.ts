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
 */
export const DEFAULT_WEBLLM_MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

/**
 * Popular WebLLM model options
 */
export const WEBLLM_MODELS = {
  // Phi models (Microsoft) - Good balance of size/quality
  'phi-3.5-mini': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'phi-3-mini': 'Phi-3-mini-4k-instruct-q4f16_1-MLC',

  // Llama models (Meta) - Higher quality, larger
  'llama-3.1-8b': 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
  'llama-3-8b': 'Llama-3-8B-Instruct-q4f16_1-MLC',

  // Gemma models (Google) - Efficient
  'gemma-2b': 'gemma-2-2b-it-q4f16_1-MLC',

  // Qwen models (Alibaba)
  'qwen-1.5b': 'Qwen2-1.5B-Instruct-q4f16_1-MLC',
  'qwen-0.5b': 'Qwen2-0.5B-Instruct-q4f16_1-MLC',

  // Mistral
  'mistral-7b': 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',

  // TinyLlama - Very small, fast loading
  'tinyllama': 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
} as const;

export type WebLLMModelAlias = keyof typeof WEBLLM_MODELS;

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
