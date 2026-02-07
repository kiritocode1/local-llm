/**
 * Transformers.js Backend Implementation
 * Fallback backend using HuggingFace Transformers.js with ONNX runtime
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
 * Using Qwen2.5 0.5B as it's well-tested with ONNX
 */
export const DEFAULT_TRANSFORMERS_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

/**
 * Transformers.js compatible models (must have ONNX weights)
 * These are specifically converted for browser use via transformers.js
 * 
 * @see https://huggingface.co/onnx-community for more models
 */
export const TRANSFORMERS_MODELS = {
  // === Qwen 2.5 Models (Alibaba) - Excellent quality ===
  'qwen-2.5-0.5b': 'onnx-community/Qwen2.5-0.5B-Instruct',
  'qwen-2.5-1.5b': 'onnx-community/Qwen2.5-1.5B-Instruct',
  'qwen-2.5-coder-0.5b': 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
  'qwen-2.5-coder-1.5b': 'onnx-community/Qwen2.5-Coder-1.5B-Instruct',

  // === Qwen 3 Models (Alibaba) - Latest generation ===
  'qwen-3-0.6b': 'onnx-community/Qwen3-0.6B-ONNX',

  // === SmolLM2 Models (HuggingFace) - Ultra lightweight ===
  'smollm2-135m': 'HuggingFaceTB/SmolLM2-135M-Instruct',
  'smollm2-360m': 'HuggingFaceTB/SmolLM2-360M-Instruct',
  'smollm2-1.7b': 'HuggingFaceTB/SmolLM2-1.7B-Instruct',

  // === Phi Models (Microsoft) ===
  'phi-3-mini': 'Xenova/Phi-3-mini-4k-instruct',

  // === TinyLlama - Very fast and light ===
  'tinyllama': 'Xenova/TinyLlama-1.1B-Chat-v1.0',
} as const;

export type TransformersModelAlias = keyof typeof TRANSFORMERS_MODELS;

/**
 * Model size estimates for UI display
 */
export const TRANSFORMERS_MODEL_SIZES: Record<TransformersModelAlias, string> = {
  'qwen-2.5-0.5b': '~350MB',
  'qwen-2.5-1.5b': '~900MB',
  'qwen-2.5-coder-0.5b': '~350MB',
  'qwen-2.5-coder-1.5b': '~900MB',
  'qwen-3-0.6b': '~400MB',
  'smollm2-135m': '~100MB',
  'smollm2-360m': '~250MB',
  'smollm2-1.7b': '~1GB',
  'phi-3-mini': '~2.3GB',
  'tinyllama': '~700MB',
};

/**
 * Detect the chat template format based on model ID
 */
function detectChatFormat(modelId: string): 'chatml' | 'llama' | 'phi' | 'generic' {
  const lower = modelId.toLowerCase();
  
  if (lower.includes('qwen') || lower.includes('smollm')) {
    return 'chatml';
  }
  if (lower.includes('llama') || lower.includes('tinyllama')) {
    return 'llama';
  }
  if (lower.includes('phi')) {
    return 'phi';
  }
  return 'generic';
}

/**
 * Format messages into a prompt string based on model type
 */
function formatPrompt(messages: ChatMessage[], modelId: string): string {
  const format = detectChatFormat(modelId);
  
  switch (format) {
    case 'chatml': {
      // ChatML format (Qwen, SmolLM, etc.)
      let prompt = '';
      for (const msg of messages) {
        prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
      }
      prompt += '<|im_start|>assistant\n';
      return prompt;
    }
    
    case 'llama': {
      // Llama/TinyLlama format
      let prompt = '';
      for (const msg of messages) {
        if (msg.role === 'system') {
          prompt += `<s>[INST] <<SYS>>\n${msg.content}\n<</SYS>>\n\n`;
        } else if (msg.role === 'user') {
          if (!prompt.includes('[INST]')) {
            prompt += `<s>[INST] ${msg.content} [/INST]`;
          } else {
            prompt += `<s>[INST] ${msg.content} [/INST]`;
          }
        } else if (msg.role === 'assistant') {
          prompt += ` ${msg.content} </s>`;
        }
      }
      return prompt;
    }
    
    case 'phi': {
      // Phi format
      let prompt = '';
      for (const msg of messages) {
        if (msg.role === 'system') {
          prompt += `<|system|>\n${msg.content}<|end|>\n`;
        } else if (msg.role === 'user') {
          prompt += `<|user|>\n${msg.content}<|end|>\n`;
        } else if (msg.role === 'assistant') {
          prompt += `<|assistant|>\n${msg.content}<|end|>\n`;
        }
      }
      prompt += '<|assistant|>\n';
      return prompt;
    }
    
    case 'generic':
    default: {
      // Simple generic format
      let prompt = '';
      for (const msg of messages) {
        prompt += `${msg.role}: ${msg.content}\n`;
      }
      prompt += 'assistant: ';
      return prompt;
    }
  }
}

/**
 * Map quantization to Transformers.js dtype
 */
function mapQuantization(quantization: Quantization): 'q4' | 'q8' | 'fp16' | 'fp32' {
  const map: Record<Quantization, 'q4' | 'q8' | 'fp16' | 'fp32'> = {
    q4: 'q4',
    q8: 'q8',
    fp16: 'fp16',
    fp32: 'fp32',
  };
  return map[quantization] ?? 'q4';
}

/**
 * Configuration for TransformersProvider
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

  private pipeline: TextGenerationPipeline | null = null;
  private currentModel: string | null = null;
  private device: Device;
  private quantization: Quantization;

  constructor(config: TransformersProviderConfig = {}) {
    this.device = config.device ?? 'auto';
    this.quantization = config.quantization ?? 'q4';
  }

  get isReady(): boolean {
    return this.pipeline !== null && this.currentModel !== null;
  }

  get modelId(): string | null {
    return this.currentModel;
  }

  async load(modelId: string, onProgress?: LoadProgressCallback): Promise<void> {
    // Resolve alias to full model ID
    const resolvedModel = modelId in TRANSFORMERS_MODELS
      ? TRANSFORMERS_MODELS[modelId as TransformersModelAlias]
      : modelId;

    // Dynamic import
    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure environment
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // Determine device
    let deviceOption: string = 'wasm';
    if (this.device === 'auto' || this.device === 'webgpu') {
      // Check if WebGPU is available
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const gpu = (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu;
          const adapter = await gpu.requestAdapter();
          if (adapter) {
            deviceOption = 'webgpu';
          }
        } catch {
          // Fall back to WASM
        }
      }
    }

    // Create pipeline with progress callback
    const dtype = mapQuantization(this.quantization);
    
    this.pipeline = await pipeline('text-generation', resolvedModel, {
      dtype: dtype as 'q4' | 'q8' | 'fp16' | 'fp32',
      device: deviceOption as 'wasm' | 'webgpu',
      progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
        if (onProgress) {
          const loadProgress: LoadProgress = {
            progress: Math.round((progress.progress ?? 0) * 100),
            status: progress.status,
          };
          onProgress(loadProgress);
        }
      },
    }) as any as TextGenerationPipeline;

    this.currentModel = resolvedModel;
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    if (!this.pipeline || !this.currentModel) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const prompt = formatPrompt(messages, this.currentModel);

    const result = await this.pipeline(prompt, {
      max_new_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 0.95,
      do_sample: true,
      return_full_text: false,
    });

    // Extract generated text
    const output = Array.isArray(result) ? result[0] : result;
    return (output as { generated_text: string }).generated_text ?? '';
  }

  async stream(
    messages: ChatMessage[],
    onToken: StreamCallback,
    options?: GenerateOptions
  ): Promise<string> {
    if (!this.pipeline || !this.currentModel) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const prompt = formatPrompt(messages, this.currentModel);

    // Transformers.js streaming via TextStreamer
    const { TextStreamer } = await import('@huggingface/transformers');
    
    let fullText = '';
    
    const streamer = new TextStreamer(this.pipeline.tokenizer, {
      skip_prompt: true,
      callback_function: (token: string) => {
        fullText += token;
        onToken(token, fullText);
      },
    });

    await this.pipeline(prompt, {
      max_new_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 0.95,
      do_sample: true,
      return_full_text: false,
      streamer,
    });

    return fullText;
  }

  async unload(): Promise<void> {
    this.pipeline = null;
    this.currentModel = null;
  }
}

/**
 * Create a Transformers.js provider instance
 */
export function createTransformersProvider(config?: TransformersProviderConfig): TransformersProvider {
  return new TransformersProvider(config);
}
