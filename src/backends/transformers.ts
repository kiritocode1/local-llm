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

// Import the specific pipeline types we need
import { pipeline, type TextGenerationPipeline, type ImageToTextPipeline } from '@huggingface/transformers';

/**
 * Default model for Transformers.js backend
 * Using Qwen2.5 0.5B as it's well-tested with ONNX
 */
import { DEFAULT_TRANSFORMERS_MODEL, TRANSFORMERS_MODELS, type TransformersModelID } from '../models';
export { DEFAULT_TRANSFORMERS_MODEL, TRANSFORMERS_MODELS };

export type TransformersModelAlias = TransformersModelID;

/**
 * Model size estimates for UI display
 */
export const TRANSFORMERS_MODEL_SIZES: Record<TransformersModelAlias, string> = {
  'qwen-2.5-0.5b': '~350MB',
  'qwen-2.5-1.5b': '~900MB',
  'qwen-2.5-coder-0.5b': '~350MB',
  'qwen-2.5-coder-1.5b': '~900MB',
  'qwen-2.5-vl-3b': '~2.6GB',
  'qwen-3-0.6b': '~400MB',
  'smollm2-135m': '~100MB',
  'smollm2-1.7b': '~1GB',
  'phi-3.5-vision': '~5GB',
  'phi-3-mini': '~2.3GB',
};

/**
 * Utility to check if a model is a vision model based on its ID
 */
function isVisionModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes('vl') || lower.includes('vision') || lower.includes('moondream');
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

  private pipeline: any = null;
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
    const task = isVisionModel(resolvedModel) ? 'image-text-to-text' : 'text-generation';

    const dtype = mapQuantization(this.quantization);

    this.pipeline = await pipeline(task as any, resolvedModel, {
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
    });

    this.currentModel = resolvedModel;
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    if (!this.pipeline || !this.currentModel) {
      throw new Error('Model not loaded. Call load() first.');
    }

    const result = await this.pipeline(messages as any, {
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

    // Transformers.js streaming via TextStreamer
    const { TextStreamer } = await import('@huggingface/transformers');
    
    let fullText = '';
    
    const streamer = new TextStreamer(this.pipeline.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => {
        fullText += token;
        onToken(token, fullText);
      },
    });

    await this.pipeline(messages as any, {
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
