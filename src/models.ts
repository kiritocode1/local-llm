/**
 * Supported Models Configuration
 */

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

  // === Vision Models ===
  'phi-3.5-vision': 'onnx-community/Phi-3.5-vision-instruct',

  // === SmolLM2 Models (HuggingFace) - Ultra lightweight ===
  'smollm2-135m': 'HuggingFaceTB/SmolLM2-135M-Instruct',
  'smollm2-1.7b': 'HuggingFaceTB/SmolLM2-1.7B-Instruct',

  // === Phi Models (Microsoft) ===
  'phi-3-mini': 'Xenova/Phi-3-mini-4k-instruct',
} as const;

export type WebLLMModelID = keyof typeof WEBLLM_MODELS;
export type TransformersModelID = keyof typeof TRANSFORMERS_MODELS;

/**
 * Union of all supported model IDs for type safety
 */
export type SupportedModel = WebLLMModelID | TransformersModelID | (string & {});
