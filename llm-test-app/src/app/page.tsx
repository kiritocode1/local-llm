"use client";

import { useState, useRef, useEffect } from "react";
import {
  LLMProvider,
  useChat,
  useLLM,
  useStream,
  useCompletion,
} from "@blank-utils/llm/react";

// ============================================================================
// Stress Test Dashboard
// ============================================================================

function StressTestDashboard() {
  const { isLoading, isReady, loadProgress, error, backend, modelId } =
    useLLM();

  return (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse" />
        Model Status
      </h2>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <span className="text-gray-400">Status</span>
          <p className="text-white font-medium mt-1">
            {isLoading
              ? "Loading..."
              : isReady
                ? "✅ Ready"
                : error
                  ? "❌ Error"
                  : "⏳ Idle"}
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3">
          <span className="text-gray-400">Backend</span>
          <p className="text-white font-medium mt-1">
            {backend ?? "Not loaded"}
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
          <span className="text-gray-400">Model</span>
          <p className="text-white font-medium mt-1 text-xs break-all">
            {modelId ?? "None"}
          </p>
        </div>

        {isLoading && loadProgress && (
          <div className="col-span-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{loadProgress.status}</span>
              <span>{Math.round(loadProgress.progress)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${loadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-xs">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Chat Stress Test
// ============================================================================

function ChatStressTest() {
  const {
    messages,
    input,
    setInput,
    send,
    isGenerating,
    isPending,
    streamingText,
    clear,
    stop,
  } = useChat({
    systemPrompt: "You are a helpful AI assistant. Keep responses concise.",
    queueWhileLoading: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [stressCount, setStressCount] = useState(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const runStressTest = async () => {
    const prompts = [
      "What is 2+2?",
      "Say hello in 3 different languages.",
      "Name 3 colors.",
      "What is the capital of France?",
      "Count from 1 to 5.",
    ];

    for (let i = 0; i < prompts.length; i++) {
      setStressCount(i + 1);
      await send(prompts[i]);
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    }
    setStressCount(0);
  };

  return (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 backdrop-blur-xl flex flex-col h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">💬</span>
          Chat Test
        </h2>
        <div className="flex gap-2">
          {stressCount > 0 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
              Stress: {stressCount}/5
            </span>
          )}
          <button
            onClick={runStressTest}
            disabled={isGenerating || isPending}
            className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full hover:opacity-80 disabled:opacity-50 transition-all"
          >
            🔥 Stress Test
          </button>
          <button
            onClick={clear}
            className="text-xs bg-gray-700 text-gray-300 px-3 py-1 rounded-full hover:bg-gray-600 transition-all"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center text-sm py-8">
            Send a message to start chatting...
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-gray-800 text-gray-200 border border-cyan-500/30">
              {streamingText}
              <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex justify-center">
            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full">
              ⏳ Waiting for model to load...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={isGenerating ? "Generating..." : "Type a message..."}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-all"
          disabled={isGenerating}
        />
        {isGenerating ? (
          <button
            onClick={stop}
            className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-all"
          >
            ⏹
          </button>
        ) : (
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-xl hover:opacity-80 disabled:opacity-50 transition-all"
          >
            ➤
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Stream Stress Test
// ============================================================================

function StreamStressTest() {
  const { text, isStreaming, stream, clear, stop } = useStream({
    onToken: (token) => {
      // Could track tokens per second here
    },
  });

  const [tokenCount, setTokenCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const runTest = async (prompt: string) => {
    setTokenCount(0);
    setStartTime(Date.now());
    await stream(prompt);
  };

  useEffect(() => {
    if (text) {
      setTokenCount(text.split(/\s+/).length);
    }
  }, [text]);

  const tokensPerSecond =
    startTime && tokenCount > 0
      ? ((tokenCount / (Date.now() - startTime)) * 1000).toFixed(1)
      : "0";

  return (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          Stream Performance
        </h2>
        <div className="flex gap-2 text-xs">
          <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">
            {tokenCount} words
          </span>
          <span className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
            {tokensPerSecond} w/s
          </span>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl p-4 min-h-[150px] max-h-[200px] overflow-y-auto mb-4">
        {text ? (
          <p className="text-gray-200 text-sm whitespace-pre-wrap">
            {text}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />
            )}
          </p>
        ) : (
          <p className="text-gray-500 text-sm">
            Click a test below to see streaming output...
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => runTest("Write a haiku about programming.")}
          disabled={isStreaming}
          className="text-xs bg-gray-700 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-all"
        >
          📝 Short
        </button>
        <button
          onClick={() =>
            runTest("Explain how WebGPU works in browsers in detail.")
          }
          disabled={isStreaming}
          className="text-xs bg-gray-700 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-all"
        >
          📚 Medium
        </button>
        <button
          onClick={() =>
            runTest(
              "Write a comprehensive guide on building a chat application with React and TypeScript. Include code examples."
            )
          }
          disabled={isStreaming}
          className="text-xs bg-gray-700 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-all"
        >
          📖 Long
        </button>
        {isStreaming ? (
          <button
            onClick={stop}
            className="text-xs bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-all ml-auto"
          >
            ⏹ Stop
          </button>
        ) : (
          <button
            onClick={clear}
            className="text-xs bg-gray-700 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-600 transition-all ml-auto"
          >
            🗑️ Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Completion Stress Test
// ============================================================================

function CompletionStressTest() {
  const { completion, isLoading, complete, clear } = useCompletion();
  const [batchResults, setBatchResults] = useState<string[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const runBatchTest = async () => {
    setIsBatchRunning(true);
    setBatchResults([]);

    const prompts = [
      "What is 1+1?",
      "Name a fruit.",
      "What color is the sky?",
    ];

    for (const prompt of prompts) {
      const result = await complete(prompt);
      setBatchResults((prev) => [...prev, `Q: ${prompt}\nA: ${result}`]);
    }

    setIsBatchRunning(false);
  };

  return (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Completion Test
        </h2>
        <button
          onClick={runBatchTest}
          disabled={isLoading || isBatchRunning}
          className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full hover:opacity-80 disabled:opacity-50 transition-all"
        >
          {isBatchRunning ? "Running..." : "🔄 Batch Test (3x)"}
        </button>
      </div>

      {batchResults.length > 0 && (
        <div className="space-y-2 mb-4">
          {batchResults.map((result, i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-3 text-xs">
              <pre className="text-gray-300 whitespace-pre-wrap">{result}</pre>
            </div>
          ))}
        </div>
      )}

      {completion && !isBatchRunning && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-200 text-sm">{completion}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

function TestContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-4">
            @blank-utils/llm
          </h1>
          <p className="text-gray-400 text-lg">
            Stress Testing Dashboard • React Integration
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StressTestDashboard />
          <StreamStressTest />
          <ChatStressTest />
          <CompletionStressTest />
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600 text-sm">
          <p>
            Package: <code className="text-cyan-400">@blank-utils/llm@0.2.0</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <LLMProvider
      backend="auto"
      model=""
      onProgress={(p) => console.log(`[LLM] ${p.status}: ${p.progress}%`)}
      onError={(e) => console.error("[LLM Error]", e)}
    >
      <TestContent />
    </LLMProvider>
  );
}
