# @blank-utils/llm

> Run LLMs directly in your browser with WebGPU acceleration

A simple, ergonomic library for running local LLMs in the browser. Features:

- 🚀 **WebGPU acceleration** via WebLLM (with WASM fallback)
- ⚛️ **React hooks** with eager background loading
- 📝 **Streaming support** with real-time token output
- 🔄 **Message queueing** - users can type while models load
- 📦 **Zero config** - works out of the box

## Installation

```bash
pnpm add @blank-utils/llm
# or
npm install @blank-utils/llm
# or
bun add @blank-utils/llm
```

## Quick Start

### React (Recommended)

```tsx
import { LLMProvider, useChat, useLLM } from "@blank-utils/llm/react";

function App() {
  return (
    <LLMProvider model="qwen-2.5-0.5b">
      <Chat />
    </LLMProvider>
  );
}

function Chat() {
  const { isLoading, loadProgress } = useLLM();
  const {
    messages,
    input,
    setInput,
    send,
    isGenerating,
    isPending,
    streamingText,
  } = useChat();

  return (
    <div>
      {isLoading && <p>Loading: {loadProgress?.progress}%</p>}

      {messages.map((m, i) => (
        <div key={i}>
          {m.role}: {m.content}
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
await llm.stream("Tell me a joke", (token) => {
  process.stdout.write(token);
});

// Or non-streaming
const response = await llm.chat("Hello!");
```

## React Hooks

### `LLMProvider`

Wrap your app with the provider to enable LLM functionality:

```tsx
<LLMProvider
  model="qwen-2.5-0.5b" // Model to load
  backend="auto" // 'webllm' | 'transformers' | 'auto'
  autoLoad={true} // Start loading immediately
  onProgress={(p) => {}} // Loading progress callback
  onLoad={(llm) => {}} // Called when ready
  onError={(err) => {}} // Error callback
>
  {children}
</LLMProvider>
```

### `useLLM()`

Access the LLM instance and loading state:

```tsx
const {
  llm, // LLM instance (null while loading)
  isLoading, // Model is downloading
  isReady, // Model ready for inference
  loadProgress, // { progress: number, status: string }
  error, // Error if failed
  modelId, // Current model ID
  backend, // 'webllm' | 'transformers'
  reload, // Reload the model
  unload, // Unload and free memory
} = useLLM();
```

### `useChat(options)`

Full chat conversation management with **eager loading** support:

```tsx
const {
  messages, // ChatMessage[]
  input, // Current input value
  setInput, // Update input
  send, // Send message (queues if loading!)
  isGenerating, // Currently generating response
  isPending, // Message queued, waiting for model
  streamingText, // Current streaming output
  stop, // Stop generation
  clear, // Clear conversation
  append, // Add message without generating
  reload, // Regenerate last response
} = useChat({
  systemPrompt: "You are a helpful assistant.",
  queueWhileLoading: true, // Queue messages while model loads
  onToken: (token, fullText) => {},
  onFinish: (response) => {},
});
```

### `useStream(options)`

Simple streaming generation:

```tsx
const { text, isStreaming, stream, stop, clear } = useStream();

await stream("Tell me a story");
```

### `useCompletion(options)`

Non-streaming completion:

```tsx
const { completion, isLoading, complete, clear } = useCompletion();

await complete("Summarize this text");
```

## Utility Components

### `<LLMLoading>`

Shows content only while loading:

```tsx
<LLMLoading>
  <p>Loading model...</p>
</LLMLoading>
```

### `<LLMReady>`

Shows content only when ready:

```tsx
<LLMReady fallback={<Loading />}>
  <ChatInterface />
</LLMReady>
```

## Available Models

### Transformers.js Backend (ONNX)

| Alias                 | Model                  | Size   |
| --------------------- | ---------------------- | ------ |
| `qwen-2.5-0.5b`       | Qwen 2.5 0.5B Instruct | ~350MB |
| `qwen-2.5-1.5b`       | Qwen 2.5 1.5B Instruct | ~900MB |
| `qwen-2.5-coder-0.5b` | Qwen 2.5 Coder 0.5B    | ~350MB |
| `smollm2-135m`        | SmolLM2 135M           | ~100MB |
| `smollm2-360m`        | SmolLM2 360M           | ~250MB |
| `tinyllama`           | TinyLlama 1.1B         | ~700MB |
| `phi-3-mini`          | Phi-3 Mini 4K          | ~2.3GB |

### WebLLM Backend (WebGPU)

| Alias           | Model         | Size   |
| --------------- | ------------- | ------ |
| `phi-3-mini`    | Phi-3 Mini 4K | ~2.3GB |
| `llama-3.2-1b`  | Llama 3.2 1B  | ~1GB   |
| `llama-3.2-3b`  | Llama 3.2 3B  | ~2GB   |
| `gemma-2-2b`    | Gemma 2 2B    | ~1.5GB |
| `qwen-2.5-0.5b` | Qwen 2.5 0.5B | ~350MB |
| `qwen-2.5-1.5b` | Qwen 2.5 1.5B | ~900MB |

## Browser Requirements

- **WebGPU** (Chrome 113+, Edge 113+) for best performance
- Falls back to **WebAssembly** for older browsers

## License

MIT License
