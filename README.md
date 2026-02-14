<p align="center">
  <strong>@blank-utils/llm</strong>
</p>

<p align="center">
  Run LLMs directly in your browser — zero server, zero API keys.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@blank-utils/llm"><img src="https://img.shields.io/npm/v/@blank-utils/llm?style=flat-square&color=0ea5e9" alt="npm"></a>
  <a href="https://github.com/kiritocode1/local-llm/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@blank-utils/llm?style=flat-square" alt="license"></a>
  <img src="https://img.shields.io/badge/react-%E2%89%A518-61dafb?style=flat-square" alt="react">
  <img src="https://img.shields.io/badge/webgpu-supported-brightgreen?style=flat-square" alt="webgpu">
</p>

---

## Features

- 🚀 **WebGPU acceleration** via [WebLLM](https://github.com/mlc-ai/web-llm) — falls back to WASM through [Transformers.js](https://github.com/huggingface/transformers.js)
- ⚛️ **React hooks** — `useChat`, `useStream`, `useCompletion` with eager background loading
- 🔤 **Type-safe model selection** — full autocomplete for 30+ supported models across both backends
- 📝 **Streaming support** — real-time token output with abort control
- 🔄 **Message queueing** — users can type while models download; messages are processed once ready
- 🧩 **Vanilla JS friendly** — works outside React with DOM helpers and a simple `createLLM()` API
- 📦 **Zero config** — auto-detects WebGPU/WASM and picks the best backend

## Installation

```bash
pnpm add @blank-utils/llm
# or
bun add @blank-utils/llm
```

> React is an **optional** peer dependency. The core API works without it.

---

## Quick Start

### Quick Chat (Fully Featured App)

The fastest way to get started. `<ChatApp>` includes the provider, model management, and UI in a single component:

```tsx
import { ChatApp } from "@blank-utils/llm/react";

export default function App() {
  return (
    <ChatApp
      defaultModel="qwen-2.5-0.5b"
      theme="dark" // 'dark' | 'light'
      systemPrompt="You are a helpful assistant."
    />
  );
}
```

### Components (Custom Setup)

If you already have a provider or want more control, use the `<Chat>` component:

```tsx
import { LLMProvider, Chat } from "@blank-utils/llm/react";

export default function App() {
  return (
    <LLMProvider model="qwen-2.5-0.5b">
      <Chat
        theme="dark"
        systemPrompt="You are a helpful assistant."
        placeholder="Ask me anything..."
      />
    </LLMProvider>
  );
}
```

### Custom UI with Hooks

Build your own interface from scratch using our hooks:

```tsx
import { LLMProvider, useChat, useLLM } from "@blank-utils/llm/react";
// ... (rest of the hooks example)

function App() {
  return (
    <LLMProvider model="qwen-2.5-0.5b">
      <ChatUI />
    </LLMProvider>
  );
}

function ChatUI() {
  const { isLoading, loadProgress } = useLLM();
  const {
    messages,
    input,
    setInput,
    send,
    isGenerating,
    isPending,
    streamingText,
  } = useChat({
    systemPrompt: "You are a helpful assistant.",
    queueWhileLoading: true,
  });

  return (
    <div>
      {isLoading && <p>Loading: {loadProgress?.progress}%</p>}

      {messages.map((m, i) => (
        <div key={i}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}

      {isPending && <p>Waiting for model...</p>}
      {isGenerating && <p>AI: {streamingText}</p>}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="Type a message..."
      />
      <button onClick={() => send()}>Send</button>
    </div>
  );
}
```

### Vanilla JavaScript

```typescript
import { createLLM } from "@blank-utils/llm";

const llm = await createLLM({
  model: "qwen-2.5-0.5b",
  onLoadProgress: (p) => console.log(`Loading: ${p.progress}%`),
});

// Streaming
await llm.stream("Tell me a joke", (token, fullText) => {
  document.getElementById("output")!.textContent = fullText;
});

// Non-streaming
const response = await llm.chat("Hello!");
console.log(response);
```

### Attach to DOM Elements

```typescript
import { createLLM } from "@blank-utils/llm";

const llm = await createLLM({ model: "smollm2-360m" });

// Wire up an input + output with one call
const cleanup = llm.attachToInput("#prompt-input", "#response-output", {
  triggerOnEnter: true,
  clearOnSend: true,
});
```

---

## Architecture

```
@blank-utils/llm
├── src/
│   ├── index.ts          # Main entry — re-exports everything
│   ├── core.ts           # createLLM() factory, LocalLLM interface
│   ├── models.ts         # Centralized model registry (single source of truth)
│   ├── types.ts          # All TypeScript interfaces & types
│   ├── detect.ts         # WebGPU / WASM capability detection
│   ├── helpers.ts        # DOM utilities (attachToElements, createChatUI, etc.)
│   ├── backends/
│   │   ├── webllm.ts     # WebLLM backend (WebGPU)
│   │   └── transformers.ts # Transformers.js backend (WASM / WebGPU)
│   └── react/
│       ├── index.tsx     # React context, provider, hooks
│       ├── components.tsx # <Chat> — ready-made chat interface
│       └── chat-input.tsx # <ChatInput> — auto-resizing input widget
└── dist/                 # Built output (ESM)
```

### Dual Backend System

|                   | **WebLLM**                | **Transformers.js** |
| ----------------- | ------------------------- | ------------------- |
| **Engine**        | MLC / TVM compiled models | ONNX Runtime        |
| **Device**        | WebGPU only               | WebGPU or WASM      |
| **Performance**   | Best (GPU-native)         | Good (CPU fallback) |
| **Model source**  | MLC prebuilt cache        | HuggingFace Hub     |
| **Auto-detected** | ✅ when WebGPU present    | ✅ fallback         |

The library auto-selects the best backend via `detectCapabilities()`. You can also force a backend:

```tsx
<LLMProvider model="llama-3.2-3b" backend="webllm" />
```

---

## React API

### `<LLMProvider>`

Wrap your app to enable LLM functionality. All hooks must be used inside this provider.

```tsx
<LLMProvider
  model="qwen-2.5-0.5b" // Model alias or full ID
  backend="auto" // 'webllm' | 'transformers' | 'auto'
  autoLoad={true} // Start loading on mount
  device="auto" // 'webgpu' | 'wasm' | 'auto'
  quantization="q4" // 'q4' | 'q8' | 'fp16' | 'fp32'
  systemPrompt="..." // Default system prompt
  onProgress={(p) => {}} // Loading progress
  onLoad={(llm) => {}} // Called when model is ready
  onError={(err) => {}} // Error handler
>
  {children}
</LLMProvider>
```

> **Tip:** Use `key={modelId}` on `<LLMProvider>` to force a full re-mount when switching models dynamically.

### `useLLM()`

Access the raw LLM instance and loading state:

```tsx
const {
  llm, // LocalLLM | null
  isLoading, // boolean — model is downloading
  isReady, // boolean — model ready for inference
  loadProgress, // { progress: number, status: string } | null
  error, // Error | null
  modelId, // string | null — current model ID
  backend, // 'webllm' | 'transformers' | null
  reload, // () => Promise<void>
  unload, // () => Promise<void>
} = useLLM();
```

### `useChat(options?)`

Full chat conversation management with **eager loading** — users can send messages while the model downloads. Messages are queued and processed automatically once the model is ready.

```tsx
const {
  messages, // ChatMessage[]
  input, // string — controlled input value
  setInput, // (value: string) => void
  send, // (content?: string) => Promise<string>
  isGenerating, // boolean
  isPending, // boolean — message queued, waiting for model
  streamingText, // string — current partial response
  stop, // () => void
  clear, // () => void
  append, // (message: ChatMessage) => void
  reload, // () => Promise<string> — regenerate last response
} = useChat({
  systemPrompt: "You are a helpful assistant.",
  queueWhileLoading: true, // default: true
  initialMessages: [],
  generateOptions: { temperature: 0.7, maxTokens: 512 },
  onStart: () => {},
  onToken: (token, fullText) => {},
  onFinish: (response) => {},
  onError: (error) => {},
});
```

### `useStream(options?)`

Simple streaming generation without chat history management:

```tsx
const { text, isStreaming, stream, stop, clear } = useStream({
  onToken: (token, fullText) => {},
  onFinish: (response) => {},
  onError: (error) => {},
  generateOptions: { temperature: 0.7 },
});

await stream("Tell me a story");
// or with message array:
await stream([{ role: "user", content: "Tell me a story" }]);
```

### `useCompletion(options?)`

Non-streaming, single-shot completion:

```tsx
const { completion, isLoading, complete, clear } = useCompletion({
  generateOptions: { maxTokens: 256 },
});

const result = await complete("Summarize this text");
```

### `<LLMLoading>` / `<LLMReady>`

Conditional rendering components:

```tsx
<LLMLoading className="loading-state">
  <p>Downloading model...</p>
</LLMLoading>

<LLMReady fallback={<Spinner />}>
  <ChatInterface />
</LLMReady>
```

### Default Chat Interface explained

The `<Chat>` and `<ChatApp>` components provide a production-ready interface with "Terminal Luxury" aesthetics.

**Key Features & Usage Points:**

- **✨ Zero Config**: Just drop it in. No CSS files to import, no state to manage.
- **🎨 Rich Text Rendering**:
  - **Global Markdown**: Bold, cursives, lists, tables.
  - **Code Blocks**: Syntax highlighting for 20+ languages.
  - **Diagrams**: Renders `mermaid` diagrams automatically.
  - **Math**: Supports LateX expressions.
- **⚡ Eager Interaction**: Users can type and send messages _while_ the model is still initializing. The chat controls the queue.
- **🌗 Theming**: Built-in 'dark' (cherry red accents) and 'light' modes.
- **🔄 Model Switching**:
  - If using `<ChatApp />`, a model selector dropdown is included automatically.
  - If using `<Chat />`, pass `onModelChange` to enable the dropdown.
- **🛠️ Extensible Toolbar**: Use the `inputActions` prop to add your own buttons (e.g., upload, clear) to the input area.

### `<Chat>` Component API

```tsx
<Chat
  // Appearance
  theme="dark" // 'dark' | 'light'
  maxHeight="600px" // CSS max-height
  className="my-chat" // Extra classes
  // Content
  systemPrompt="..." // Default: "You are a helpful AI assistant..."
  welcomeMessage="..." // Text shown when chat is empty
  placeholder="..." // Input placeholder
  // Features
  showHeader={true} // Toggle header/model info
  showProgress={true} // Toggle loading progress bar
  // Callbacks
  onSend={(msg) => {}} // Listen to user messages
  onResponse={(res) => {}} // Listen to AI responses
  onModelChange={(id) => {}} // Enable model switching dropdown
  inputActions={
    <>
      <button>Clear</button>
    </>
  } // Add custom buttons
/>
```

### `<ChatApp>` Component API

Wrapper that combines `LLMProvider` and `Chat`.

```tsx
<ChatApp
  defaultModel="qwen-2.5-0.5b"
  defaultBackend="auto" // 'webllm' | 'transformers'
  autoLoad={true} // Start downloading immediately
  {...chatProps} // All <Chat> props are supported
/>
```

### `<ChatInput>`

Standalone auto-resizing input component. Use it to build custom chat layouts:

```tsx
import { ChatInput } from "@blank-utils/llm/react";

<ChatInput
  value={input} // Controlled value
  onChange={setInput} // Value change handler
  onSend={handleSend} // Submit handler (Enter or button)
  onStop={handleStop} // Stop generation
  disabled={false} // Disable input
  isGenerating={false} // Show stop button instead of send
  placeholder="Type..." // Placeholder text
  maxRows={5} // Max rows before scroll
  theme="dark" // 'dark' | 'light'
  actions={<MyButtons />} // Custom toolbar actions
/>;
```

**Features:**

- 📝 Auto-resizes up to `maxRows` then scrolls
- ⌨️ Enter to send, Shift+Enter for newline
- ⏹️ Stop button while generating
- 🎨 Dark/light theme support

---

## Vanilla JS API

### `createLLM(config?)`

Factory function that auto-detects capabilities, picks a backend, loads a model, and returns a ready-to-use `LocalLLM` instance:

```typescript
import { createLLM } from "@blank-utils/llm";

const llm = await createLLM({
  model: "phi-3.5-mini",
  backend: "auto",
  systemPrompt: "You are a helpful assistant.",
  onLoadProgress: (p) => console.log(`${p.status}: ${p.progress}%`),
});

// Chat (non-streaming)
const answer = await llm.chat("What is 2+2?");

// Stream
await llm.stream("Write a poem", (token, fullText) => {
  process.stdout.write(token);
});

// Attach to DOM
const cleanup = llm.attachToInput("#input", "#output");

// Free resources
await llm.unload();
```

### DOM Helpers

```typescript
import {
  createOutputStreamer,
  attachToElements,
  createChatUI,
  createLoadingIndicator,
} from "@blank-utils/llm";

// Auto-scroll streaming output into an element
const streamer = createOutputStreamer("#output", { scrollToBottom: true });

// Create a full chat UI in one call
const { input, output, sendButton, cleanup } = createChatUI("#container");

// Progress indicator
const loading = createLoadingIndicator("#loading-container");
loading.show();
loading.setProgress(50, "Downloading weights...");
loading.hide();
```

### Capability Detection

```typescript
import {
  detectCapabilities,
  logCapabilities,
  isWebGPUSupported,
} from "@blank-utils/llm";

const caps = await detectCapabilities();
// { webgpu: true, wasm: true, recommendedBackend: 'webllm', recommendedDevice: 'webgpu' }

await logCapabilities(); // Pretty-prints to console

if (await isWebGPUSupported()) {
  console.log("WebGPU is available!");
}
```

---

## Available Models

All models are defined in `src/models.ts` and exported as `WEBLLM_MODELS` and `TRANSFORMERS_MODELS`.  
You can use either the **alias** (short name) or the **full model ID** when specifying a model.

### WebLLM Backend (WebGPU)

| Alias                   | Model                        | Notes                       |
| ----------------------- | ---------------------------- | --------------------------- |
| `llama-3.2-1b`          | Llama 3.2 1B Instruct        | Compact, great quality      |
| `llama-3.2-3b`          | Llama 3.2 3B Instruct        | Balanced                    |
| `llama-3.1-8b`          | Llama 3.1 8B Instruct        | High quality                |
| `llama-3.1-8b-1k`       | Llama 3.1 8B (1K ctx)        | Lower memory                |
| `phi-3.5-mini`          | Phi 3.5 Mini Instruct        | **Default** — great balance |
| `phi-3.5-mini-1k`       | Phi 3.5 Mini (1K ctx)        | Lower memory                |
| `phi-3.5-vision`        | Phi 3.5 Vision               | Vision model                |
| `qwen-2.5-0.5b`         | Qwen 2.5 0.5B                | Tiny, fast                  |
| `qwen-2.5-1.5b`         | Qwen 2.5 1.5B                | Small                       |
| `qwen-2.5-3b`           | Qwen 2.5 3B                  | Medium                      |
| `qwen-2.5-7b`           | Qwen 2.5 7B                  | Large                       |
| `qwen-2.5-coder-0.5b`   | Qwen 2.5 Coder 0.5B          | Code-focused                |
| `qwen-2.5-coder-1.5b`   | Qwen 2.5 Coder 1.5B          | Code-focused                |
| `qwen-3-0.6b`           | Qwen 3 0.6B                  | Latest gen                  |
| `qwen-3-1.7b`           | Qwen 3 1.7B                  | Latest gen                  |
| `qwen-3-4b`             | Qwen 3 4B                    | Latest gen                  |
| `qwen-3-8b`             | Qwen 3 8B                    | Latest gen                  |
| `gemma-2-2b`            | Gemma 2 2B                   | Google, efficient           |
| `gemma-2-2b-1k`         | Gemma 2 2B (1K ctx)          | Lower memory                |
| `gemma-2-9b`            | Gemma 2 9B                   | Large                       |
| `smollm2-135m`          | SmolLM2 135M                 | Ultra lightweight           |
| `smollm2-360m`          | SmolLM2 360M                 | Lightweight                 |
| `smollm2-1.7b`          | SmolLM2 1.7B                 | Small                       |
| `mistral-7b`            | Mistral 7B v0.3              | General purpose             |
| `deepseek-r1-qwen-7b`   | DeepSeek R1 Distill Qwen 7B  | Reasoning                   |
| `deepseek-r1-llama-8b`  | DeepSeek R1 Distill Llama 8B | Reasoning                   |
| `hermes-3-llama-3.2-3b` | Hermes 3 Llama 3.2 3B        | Function calling            |
| `hermes-3-llama-3.1-8b` | Hermes 3 Llama 3.1 8B        | Function calling            |

### Transformers.js Backend (CPU / WASM)

| Alias                 | HuggingFace Model ID                         | Notes        |
| --------------------- | -------------------------------------------- | ------------ |
| `qwen-2.5-0.5b`       | `onnx-community/Qwen2.5-0.5B-Instruct`       | **Default**  |
| `qwen-2.5-1.5b`       | `onnx-community/Qwen2.5-1.5B-Instruct`       | Good quality |
| `qwen-2.5-coder-0.5b` | `onnx-community/Qwen2.5-Coder-0.5B-Instruct` | Code         |
| `qwen-2.5-coder-1.5b` | `onnx-community/Qwen2.5-Coder-1.5B-Instruct` | Code         |
| `qwen-3-0.6b`         | `onnx-community/Qwen3-0.6B-ONNX`             | Latest gen   |
| `smollm2-135m`        | `HuggingFaceTB/SmolLM2-135M-Instruct`        | Ultra fast   |
| `smollm2-360m`        | `HuggingFaceTB/SmolLM2-360M-Instruct`        | Fast         |
| `smollm2-1.7b`        | `HuggingFaceTB/SmolLM2-1.7B-Instruct`        | Good         |
| `phi-3-mini`          | `Xenova/Phi-3-mini-4k-instruct`              | Strong       |
| `tinyllama`           | `Xenova/TinyLlama-1.1B-Chat-v1.0`            | Very fast    |

### Type-Safe Model Selection

The `model` prop accepts any key from `WEBLLM_MODELS` or `TRANSFORMERS_MODELS` with full autocomplete, while still allowing arbitrary strings for custom models:

```typescript
import type {
  SupportedModel,
  WebLLMModelID,
  TransformersModelID,
} from "@blank-utils/llm";

// Full autocomplete for known models
const model: SupportedModel = "qwen-2.5-0.5b"; // ✅ autocomplete

// Custom model IDs still work
const custom: SupportedModel = "my-org/custom-model-onnx"; // ✅ no error

// Import the model maps for programmatic use
import { WEBLLM_MODELS, TRANSFORMERS_MODELS } from "@blank-utils/llm";

Object.keys(WEBLLM_MODELS); // all WebLLM aliases
Object.keys(TRANSFORMERS_MODELS); // all Transformers.js aliases
```

---

## Build & Development

```bash
# Install dependencies
bun install

# Build (clean → bundle → assets → types)
bun run build

# Type-check only
bun run typecheck

# Run demo page
bun run demo

# Run tests
bun test
```

### Build Pipeline

| Script        | What it does                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `clean`       | Removes `dist/`                                                                                                    |
| `build:js`    | Bundles `src/index.ts` → `dist/index.js` and `src/react/index.tsx` → `dist/react/index.js` (ESM, externals: react) |
| `postbuild`   | Copies WASM + ONNX runtime assets into `dist/` and `dist/react/`                                                   |
| `build:types` | Generates `.d.ts` declaration files via `tsc`                                                                      |
| `build`       | Runs all of the above in sequence                                                                                  |

### Package Exports

```jsonc
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
  },
  "./react": {
    "types": "./dist/react/index.d.ts",
    "import": "./dist/react/index.js",
  },
}
```

---

## Browser Requirements

| Feature               | Minimum                    | Notes                          |
| --------------------- | -------------------------- | ------------------------------ |
| **WebGPU**            | Chrome 113+, Edge 113+     | Required for WebLLM backend    |
| **WebAssembly**       | All modern browsers        | Fallback for Transformers.js   |
| **SharedArrayBuffer** | Requires COOP/COEP headers | Needed for multi-threaded WASM |

The library automatically detects capabilities and picks the best backend. No manual configuration needed.

---

## License

MIT © [blank](https://github.com/kiritocode1)
