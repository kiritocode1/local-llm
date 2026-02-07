/**
 * DOM Helper Utilities
 * Easy integration with HTML input/output elements
 */

import type { StreamCallback, AttachOptions } from './types';

/**
 * Get an element by selector, throw if not found
 */
function getElement<T extends HTMLElement>(selector: string | T): T {
  if (typeof selector === 'string') {
    const el = document.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Element not found: ${selector}`);
    }
    return el;
  }
  return selector;
}

/**
 * Creates a streaming callback that updates an output element
 */
export function createOutputStreamer(
  outputSelector: string | HTMLElement,
  options?: {
    append?: boolean;
    scrollToBottom?: boolean;
  }
): StreamCallback {
  const output = getElement(outputSelector);
  const append = options?.append ?? false;
  const scrollToBottom = options?.scrollToBottom ?? true;

  let baseContent = append ? output.textContent ?? '' : '';

  return (_token: string, fullText: string) => {
    // Use textContent for plain text, innerHTML for HTML
    if (output instanceof HTMLInputElement || output instanceof HTMLTextAreaElement) {
      output.value = baseContent + fullText;
    } else {
      output.textContent = baseContent + fullText;
    }

    // Auto-scroll
    if (scrollToBottom) {
      output.scrollTop = output.scrollHeight;
    }
  };
}

/**
 * Attach LLM to input/output elements with automatic handling
 */
export function attachToElements(
  inputSelector: string | HTMLInputElement | HTMLTextAreaElement,
  outputSelector: string | HTMLElement,
  generateFn: (input: string, onToken: StreamCallback) => Promise<string>,
  options?: AttachOptions
): () => void {
  const input = getElement<HTMLInputElement | HTMLTextAreaElement>(inputSelector);
  const output = getElement(outputSelector);

  const triggerOnEnter = options?.triggerOnEnter ?? true;
  const clearOnSend = options?.clearOnSend ?? true;
  const showLoading = options?.showLoading ?? true;
  const loadingText = options?.loadingText ?? 'Thinking...';

  let isGenerating = false;

  const handleGenerate = async () => {
    if (isGenerating) return;

    const text = input.value.trim();
    if (!text) return;

    isGenerating = true;

    // Clear input
    if (clearOnSend) {
      input.value = '';
    }

    // Show loading
    if (showLoading) {
      if (output instanceof HTMLInputElement || output instanceof HTMLTextAreaElement) {
        output.value = loadingText;
      } else {
        output.textContent = loadingText;
      }
    }

    try {
      const streamer = createOutputStreamer(output);
      await generateFn(text, streamer);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Generation failed';
      if (output instanceof HTMLInputElement || output instanceof HTMLTextAreaElement) {
        output.value = `Error: ${errorMsg}`;
      } else {
        output.textContent = `Error: ${errorMsg}`;
      }
    } finally {
      isGenerating = false;
    }
  };

  // Event listeners
  const keydownHandler = (e: KeyboardEvent) => {
    if (triggerOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  input.addEventListener('keydown', keydownHandler as EventListener);

  // Return cleanup function
  return () => {
    input.removeEventListener('keydown', keydownHandler as EventListener);
  };
}

/**
 * Create a simple chat UI in a container
 */
export function createChatUI(containerSelector: string | HTMLElement): {
  input: HTMLTextAreaElement;
  output: HTMLDivElement;
  sendButton: HTMLButtonElement;
  cleanup: () => void;
} {
  const container = getElement(containerSelector);

  // Create chat structure
  container.innerHTML = `
    <div class="llm-chat" style="display: flex; flex-direction: column; height: 100%; font-family: system-ui, sans-serif;">
      <div class="llm-chat-output" style="flex: 1; overflow-y: auto; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; min-height: 200px; background: #fafafa;">
        <p style="color: #9ca3af; margin: 0;">Start chatting...</p>
      </div>
      <div class="llm-chat-input-row" style="display: flex; gap: 0.5rem;">
        <textarea class="llm-chat-input" placeholder="Type a message..." style="flex: 1; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; resize: none; font-size: 1rem; font-family: inherit;"></textarea>
        <button class="llm-chat-send" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 500;">Send</button>
      </div>
    </div>
  `;

  const input = container.querySelector<HTMLTextAreaElement>('.llm-chat-input')!;
  const output = container.querySelector<HTMLDivElement>('.llm-chat-output')!;
  const sendButton = container.querySelector<HTMLButtonElement>('.llm-chat-send')!;

  const cleanup = () => {
    container.innerHTML = '';
  };

  return { input, output, sendButton, cleanup };
}

/**
 * Create a loading indicator
 */
export function createLoadingIndicator(containerSelector: string | HTMLElement): {
  show: () => void;
  hide: () => void;
  setProgress: (percent: number, status?: string) => void;
  element: HTMLDivElement;
} {
  const container = getElement(containerSelector);

  const indicator = document.createElement('div');
  indicator.className = 'llm-loading';
  indicator.style.cssText = `
    display: none;
    padding: 1rem;
    background: #f3f4f6;
    border-radius: 8px;
    text-align: center;
    font-family: system-ui, sans-serif;
  `;
  indicator.innerHTML = `
    <div class="llm-loading-progress" style="height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; margin-bottom: 0.5rem;">
      <div class="llm-loading-bar" style="height: 100%; width: 0%; background: #3b82f6; transition: width 0.2s;"></div>
    </div>
    <div class="llm-loading-status" style="font-size: 0.875rem; color: #6b7280;">Loading...</div>
  `;

  container.appendChild(indicator);

  const bar = indicator.querySelector<HTMLDivElement>('.llm-loading-bar')!;
  const status = indicator.querySelector<HTMLDivElement>('.llm-loading-status')!;

  return {
    show: () => {
      indicator.style.display = 'block';
    },
    hide: () => {
      indicator.style.display = 'none';
    },
    setProgress: (percent: number, statusText?: string) => {
      bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      if (statusText !== undefined) {
        status.textContent = statusText;
      }
    },
    element: indicator,
  };
}
