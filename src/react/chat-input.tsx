/**
 * ChatInput — Self-contained auto-resizing textarea with send button, image paste, and model selector slot.
 * Zero external dependencies. All styles embedded via CSS-in-JS.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   value={input}
 *   onChange={setInput}
 *   onSend={handleSend}
 *   disabled={isGenerating}
 *   placeholder="Type a message..."
 *   images={images}
 *   onImageAdd={handleAddImage}
 *   onImageRemove={handleRemoveImage}
 *   modelSelector={<MyDropdown />}
 * />
 * ```
 */

import * as React from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ImageAttachment {
  id: string;
  dataUrl: string; // base64 data:image/...
  file: File;
  name: string;
}

export interface ChatInputProps {
  /** Current value of the input */
  value: string;

  /** Called when value changes */
  onChange: (value: string) => void;

  /** Called when user submits (Enter or send button) */
  onSend: () => void;

  /** Called when user clicks stop */
  onStop?: () => void;

  /** Whether the input is disabled (e.g. during generation) */
  disabled?: boolean;

  /** Whether currently generating (shows stop button instead of send) */
  isGenerating?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Maximum rows before scrolling */
  maxRows?: number;

  /** Optional action elements to render in the toolbar */
  actions?: React.ReactNode;

  /** Theme */
  theme?: 'dark' | 'light';

  /** Additional className for the container */
  className?: string;

  /** Current images attached */
  images?: ImageAttachment[];

  /** Called when an image is added (paste/drop) */
  onImageAdd?: (image: ImageAttachment) => void;

  /** Called when an image is removed */
  onImageRemove?: (id: string) => void;

  /** Optional slot for a model selector dropdown */
  modelSelector?: React.ReactNode;
}

// ============================================================================
// Inline SVG Icons
// ============================================================================

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ============================================================================
// Styles
// ============================================================================

const STYLE_ID = '__llm-chat-input-styles';

function injectStyles(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const isDark = theme === 'dark';

  const css = `
    .llm-ci {
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'};
      background: ${isDark ? '#09090b' : '#ffffff'};
      padding: 12px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .llm-ci:focus-within {
      border-color: ${isDark ? '#fb7185' : '#e11d48'};
      box-shadow: 0 0 0 2px ${isDark ? 'rgba(251,113,133,0.2)' : 'rgba(225,29,72,0.1)'}, 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    /* Attached Images */
    .llm-ci-images {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .llm-ci-image-preview {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      animation: llm-ci-fadein 0.2s ease-out;
    }
    .llm-ci-image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .llm-ci-image-remove {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.1s;
    }
    .llm-ci-image-preview:hover .llm-ci-image-remove {
      opacity: 1;
    }

    /* Textarea */
    .llm-ci textarea {
      width: 100%;
      min-height: 24px;
      max-height: 200px;
      resize: none;
      border: none;
      outline: none;
      background: transparent;
      color: ${isDark ? '#fafafa' : '#09090b'};
      font-size: 14px;
      line-height: 1.5;
      padding: 0;
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      scrollbar-width: thin;
    }
    .llm-ci textarea::placeholder {
      color: ${isDark ? '#52525b' : '#a1a1aa'};
    }

    /* Toolbar */
    .llm-ci-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      min-height: 32px;
    }
    .llm-ci-left-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .llm-ci-right-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Buttons */
    .llm-ci-btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: ${isDark ? '#a1a1aa' : '#71717a'};
      cursor: pointer;
      transition: all 0.15s;
    }
    .llm-ci-btn-icon:hover {
      background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'};
      color: ${isDark ? '#fafafa' : '#09090b'};
    }

    /* Send Button */
    .llm-ci-send {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      padding: 0 12px;
      border-radius: 14px;
      border: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      gap: 6px;
    }
    .llm-ci-send--active {
      background: ${isDark ? '#fb7185' : '#e11d48'};
      color: white;
    }
    .llm-ci-send--active:hover {
      background: ${isDark ? '#f43f5e' : '#be123c'}; /* slightly darker rose */
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(225,29,72, 0.2);
    }
    .llm-ci-send--active:active {
      transform: translateY(0);
    }
    .llm-ci-send--disabled {
      background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
      color: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
      cursor: not-allowed;
    }
    .llm-ci-send--stop {
      background: transparent;
      border: 1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'};
      color: ${isDark ? '#f87171' : '#ef4444'};
    }
    .llm-ci-send--stop:hover {
      background: ${isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)'};
    }

    /* Model Selector Slot */
    .llm-ci-model-selector {
      margin-right: auto;
    }

    /* Drag Overlay */
    .llm-ci-drag-overlay {
      position: absolute;
      inset: 0;
      background: ${isDark ? 'rgba(24,24,27,0.8)' : 'rgba(255,255,255,0.8)'};
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      z-index: 10;
      animation: llm-ci-fadein 0.15s ease-out;
      border: 2px dashed ${isDark ? '#fb7185' : '#e11d48'};
      color: ${isDark ? '#fb7185' : '#e11d48'};
      font-weight: 500;
      font-size: 14px;
    }

    @keyframes llm-ci-fadein {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================================
// Component
// ============================================================================

function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isGenerating = false,
  placeholder = 'Type a message...',
  maxRows = 8,
  actions,
  theme = 'dark',
  className,
  images = [],
  onImageAdd,
  onImageRemove,
  modelSelector,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Inject styles
  useEffect(() => {
    injectStyles(theme);
  }, [theme]);

  // Auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const lineHeight = 21;
    const maxHeight = lineHeight * maxRows + 24;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, maxRows]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && (value.trim() || images.length > 0)) {
          onSend();
        }
      }
    },
    [disabled, value, images.length, onSend]
  );

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        const id = Math.random().toString(36).substring(7);
        onImageAdd?.({
          id,
          dataUrl: e.target.result,
          file,
          name: file.name
        });
      }
    };
    reader.readAsDataURL(file);
  }, [onImageAdd]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) processFile(file);
      }
    }
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) processFile(file);
    }
  }, [processFile]);

  const hasValue = value.trim().length > 0 || images.length > 0;
  const canSend = hasValue && !disabled && !isGenerating;

  let sendClass = 'llm-ci-send';
  if (isGenerating) {
    sendClass += ' llm-ci-send--stop';
  } else if (canSend) {
    sendClass += ' llm-ci-send--active';
  } else {
    sendClass += ' llm-ci-send--disabled';
  }

  return (
    <div 
      className={`llm-ci${className ? ` ${className}` : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="llm-ci-drag-overlay">
          Drop image to attach
        </div>
      )}

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="llm-ci-images">
          {images.map((img) => (
            <div key={img.id} className="llm-ci-image-preview">
              <img src={img.dataUrl} alt="attachment" />
              <button 
                type="button"
                className="llm-ci-image-remove"
                onClick={() => onImageRemove?.(img.id)}
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled && !isGenerating}
        rows={1}
      />

      <div className="llm-ci-toolbar">
        <div className="llm-ci-left-actions">
          {modelSelector && (
            <div className="llm-ci-model-selector">
              {modelSelector}
            </div>
          )}
          
          <button 
            type="button" 
            className="llm-ci-btn-icon" 
            onClick={() => {
              // Trigger hidden file input could be added here
              // For now relying on paste/drag
            }}
            title="Paste or Drag image"
          >
            <ImageIcon />
          </button>
          
          {actions}
        </div>

        <div className="llm-ci-right-actions">
          <button
            type="button"
            className={sendClass}
            onClick={isGenerating ? onStop : onSend}
            disabled={!isGenerating && !canSend}
            aria-label={isGenerating ? 'Stop generation' : 'Send message'}
          >
            {isGenerating ? (
              <>
                <StopIcon /> Stop
              </>
            ) : (
              <>
                Send <SendIcon />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ChatInput };
