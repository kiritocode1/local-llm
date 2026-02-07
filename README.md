# 🧠 Local LLM

Run Large Language Models directly in your browser with WebGPU acceleration. Zero server, full privacy.

## Features

- **🔒 Privacy First** - All inference happens locally, no data sent to servers
- **⚡ WebGPU Acceleration** - Near-native performance with GPU support
- **🔄 Auto-Fallback** - Gracefully falls back to WASM when WebGPU unavailable
- **📦 Zero Config** - Works out of the box with sensible defaults
- **🎯 Simple API** - Just 3 lines to start chatting
- **🖥️ DOM Helpers** - Easy integration with input elements

## Quick Start

```bash
bun add local-llm
# or
pnpm add local-llm
```

```typescript
import { createLLM } from "local-llm";

// Create and load model (auto-selects best backend)
const llm = await createLLM({
  onLoadProgress: (p) => console.log(`${p.progress}% - ${p.status}`),
});

// Chat with streaming
await llm.stream("Tell me a joke", (token) => {
  process.stdout.write(token);
});

// Or attach directly to DOM elements
llm.attachToInput("#chat-input", "#chat-output");
```

## Supported Backends

### WebLLM (Primary)

Uses MLC's WebLLM for high-performance WebGPU inference.

**Supported Models:**

- `phi-3.5-mini` - Phi 3.5 Mini (~2.5GB)
- `llama-3.1-8b` - Llama 3.1 8B (~4GB)
- `qwen-0.5b` - Qwen 0.5B (~350MB)
- `tinyllama` - TinyLlama 1.1B (~700MB)

### Transformers.js (Fallback)

Uses HuggingFace Transformers.js with ONNX runtime.

**Supported Models:**

- `qwen-0.5b` - Qwen 0.5B (~350MB)
- `smollm-135m` - SmolLM 135M (~100MB)
- `smollm-360m` - SmolLM 360M (~250MB)

## API Reference

### `createLLM(config?)`

Creates a new LLM instance with the specified configuration.

```typescript
const llm = await createLLM({
  // Model alias or full ID
  model: "phi-3.5-mini",

  // 'auto' | 'webllm' | 'transformers'
  backend: "auto",

  // 'auto' | 'webgpu' | 'wasm'
  device: "auto",

  // System prompt for all conversations
  systemPrompt: "You are a helpful assistant.",

  // Loading progress callback
  onLoadProgress: (progress) => {
    console.log(`${progress.progress}% - ${progress.status}`);
  },
});
```

### `llm.chat(messages, options?)`

Generate a response (non-streaming).

```typescript
const response = await llm.chat("What is 2+2?");
// or with message array
const response = await llm.chat([{ role: "user", content: "What is 2+2?" }]);
```

### `llm.stream(messages, onToken, options?)`

Generate with streaming output.

```typescript
await llm.stream("Tell me a story", (token, fullText) => {
  console.log(token); // Individual token
  updateUI(fullText); // Full response so far
});
```

### `llm.attachToInput(inputSelector, outputSelector, options?)`

Attach to DOM elements for automatic handling.

```typescript
const cleanup = llm.attachToInput("#input", "#output", {
  triggerOnEnter: true,
  clearOnSend: true,
  showLoading: true,
  loadingText: "Thinking...",
});

// Later: cleanup() to remove listeners
```

### Capability Detection

```typescript
import { detectCapabilities, isWebGPUSupported } from "local-llm";

// Full capability check
const caps = await detectCapabilities();
console.log(caps.webgpu); // true/false
console.log(caps.recommendedBackend); // 'webllm' | 'transformers'

// Quick WebGPU check
if (await isWebGPUSupported()) {
  console.log("WebGPU available!");
}
```

## Browser Support

| Browser      | WebGPU     | WASM Fallback |
| ------------ | ---------- | ------------- |
| Chrome 113+  | ✅         | ✅            |
| Edge 113+    | ✅         | ✅            |
| Safari 18+   | ✅         | ✅            |
| Firefox 127+ | ⚠️ Nightly | ✅            |

## Development

```bash
# Install dependencies
bun install

# Run demo
bun run demo

# Build for distribution
bun run build

# Type check
bun run typecheck
```

## License

MIT
