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
  // === Llama 3.2 Models ===
  'llama-3.2-1b': 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'llama-3.2-3b': 'Llama-3.2-3B-Instruct-q4f16_1-MLC',

  // === Llama 3.1 & 3 Models ===
  'llama-3.1-8b': 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
  'llama-3.1-8b-1k': 'Llama-3.1-8B-Instruct-q4f16_1-MLC-1k',
  'llama-3.1-70b': 'Llama-3.1-70B-Instruct-q3f16_1-MLC',
  'llama-3-8b': 'Llama-3-8B-Instruct-q4f16_1-MLC',
  'llama-3-8b-1k': 'Llama-3-8B-Instruct-q4f16_1-MLC-1k',
  'llama-3-70b': 'Llama-3-70B-Instruct-q3f16_1-MLC',

  // === Llama 2 Models ===
  'llama-2-7b': 'Llama-2-7b-chat-hf-q4f16_1-MLC',
  'llama-2-7b-1k': 'Llama-2-7b-chat-hf-q4f16_1-MLC-1k',
  'llama-2-13b': 'Llama-2-13b-chat-hf-q4f16_1-MLC',

  // === Phi Models ===
  'phi-3.5-mini': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'phi-3.5-mini-1k': 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k',
  'phi-3.5-vision': 'Phi-3.5-vision-instruct-q4f16_1-MLC', // Vision model
  'phi-3-mini-4k': 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
  'phi-3-mini-4k-1k': 'Phi-3-mini-4k-instruct-q4f16_1-MLC-1k',
  'phi-2': 'phi-2-q4f16_1-MLC',
  'phi-1.5': 'phi-1_5-q4f16_1-MLC',

  // === Qwen 3 Models ===
  'qwen3-0.6b': 'Qwen3-0.6B-q4f16_1-MLC',
  'qwen3-1.7b': 'Qwen3-1.7B-q4f16_1-MLC',
  'qwen3-4b': 'Qwen3-4B-q4f16_1-MLC',
  'qwen3-8b': 'Qwen3-8B-q4f16_1-MLC',

  // === Qwen 2.5 Models ===
  'qwen-2.5-0.5b': 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-1.5b': 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-3b': 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'qwen-2.5-7b': 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
  'qwen-2.5-coder-0.5b': 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-coder-1.5b': 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
  'qwen-2.5-coder-3b': 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
  'qwen-2.5-coder-7b': 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
  'qwen-2.5-math-1.5b': 'Qwen2.5-Math-1.5B-Instruct-q4f16_1-MLC',

  // === Qwen 2 Models ===
  'qwen2-math-1.5b': 'Qwen2-Math-1.5B-Instruct-q4f16_1-MLC',
  'qwen2-math-7b': 'Qwen2-Math-7B-Instruct-q4f16_1-MLC',

  // === Gemma 2 Models ===
  'gemma-2-2b': 'gemma-2-2b-it-q4f16_1-MLC',
  'gemma-2-2b-1k': 'gemma-2-2b-it-q4f16_1-MLC-1k',
  'gemma-2-9b': 'gemma-2-9b-it-q4f16_1-MLC',
  'gemma-2-2b-jpn': 'gemma-2-2b-jpn-it-q4f16_1-MLC',

  // === Gemma 1 Models ===
  'gemma-2b': 'gemma-2b-it-q4f16_1-MLC',
  'gemma-2b-1k': 'gemma-2b-it-q4f16_1-MLC-1k',

  // === SmolLM2 Models ===
  'smollm2-135m': 'SmolLM2-135M-Instruct-q0f16-MLC',
  'smollm2-360m': 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  'smollm2-1.7b': 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',

  // === Mistral & Ministral Models ===
  'mistral-7b': 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
  'mistral-7b-v0.2': 'Mistral-7B-Instruct-v0.2-q4f16_1-MLC',
  'ministral-3-3b-base': 'Ministral-3-3B-Base-2512-q4f16_1-MLC',
  'ministral-3-3b-reasoning': 'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC',
  'ministral-3-3b-instruct': 'Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC',

  // === DeepSeek R1 Distill Models ===
  'deepseek-r1-qwen-7b': 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
  'deepseek-r1-llama-8b': 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',

  // === Hermes Models ===
  'hermes-3-llama-3.2-3b': 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',
  'hermes-3-llama-3.1-8b': 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
  'hermes-2-theta-llama-3-8b': 'Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC',
  'hermes-2-pro-llama-3-8b': 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
  'hermes-2-pro-mistral-7b': 'Hermes-2-Pro-Mistral-7B-q4f16_1-MLC',
  'openhermes-2.5-mistral-7b': 'OpenHermes-2.5-Mistral-7B-q4f16_1-MLC',
  'neuralhermes-2.5-mistral-7b': 'NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC',
  
  // === Other Models ===
  'tinyllama-1.1b': 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
  'tinyllama-1.1b-1k': 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k',
  'tinyllama-1.1b-v0.4': 'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC',
  'tinyllama-1.1b-v0.4-1k': 'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC-1k',
  'redpajama-3b': 'RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC',
  'redpajama-3b-1k': 'RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC-1k',
  'stablelm-2-zephyr-1.6b': 'stablelm-2-zephyr-1_6b-q4f16_1-MLC',
  'stablelm-2-zephyr-1.6b-1k': 'stablelm-2-zephyr-1_6b-q4f16_1-MLC-1k',
  'wizardmath-7b': 'WizardMath-7B-V1.1-q4f16_1-MLC',
} as const;


export type WebLLMModelID = keyof typeof WEBLLM_MODELS;

/**
 * Union of all supported model IDs for type safety
 */
export type SupportedModel = WebLLMModelID | (string & {});
