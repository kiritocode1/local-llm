/**
 * ChatInput — Self-contained auto-resizing textarea with send button, image paste/upload, and model selector slot.
 * Zero external dependencies. All styles embedded via CSS-in-JS.
 * Brutalist minimal aesthetic — flat, no decoration.
 *
 * Supports: Ctrl+V paste, drag-and-drop, and click-to-upload for images.
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

  /** Called when an image is added (paste/drop/upload) */
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="0" ry="0" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ============================================================================
// Styles — Brutalist, flat, high-contrast. No shadows. No gradients.
// ============================================================================

const STYLE_ID = '__llm-chat-input-styles';

function injectStyles(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const d = theme === 'dark';

  const border = d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const borderFocus = d ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const bg = d ? '#000000' : '#ffffff';
  const text = d ? '#ffffff' : '#000000';
  const textMuted = d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const textSecondary = d ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const monoFont = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace`;
  const sansFont = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif`;

  const css = `
    .llm-ci {
      display: flex;
      flex-direction: column;
      border: 1px solid ${border};
      background: ${bg};
      padding: 12px;
      transition: border-color 0.15s;
      position: relative;
    }
    .llm-ci:focus-within {
      border-color: ${borderFocus};
    }

    /* Attached Images */
    .llm-ci-images {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .llm-ci-image-preview {
      position: relative;
      width: 52px;
      height: 52px;
      overflow: hidden;
      border: 1px solid ${border};
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
      width: 16px;
      height: 16px;
      background: ${d ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)'};
      color: ${text};
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
      color: ${text};
      font-size: 14px;
      line-height: 1.5;
      padding: 0;
      margin: 0;
      font-family: ${sansFont};
      scrollbar-width: thin;
    }
    .llm-ci textarea::placeholder {
      color: ${textMuted};
    }

    /* Toolbar */
    .llm-ci-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      min-height: 28px;
    }
    .llm-ci-left-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .llm-ci-right-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Icon Buttons */
    .llm-ci-btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: ${textSecondary};
      cursor: pointer;
      transition: color 0.1s;
    }
    .llm-ci-btn-icon:hover {
      color: ${text};
    }

    /* Send / Stop — flat, monospace, uppercase */
    .llm-ci-send {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      padding: 0 12px;
      border: 1px solid ${border};
      font-size: 10px;
      font-weight: 400;
      font-family: ${monoFont};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.1s;
      gap: 6px;
      background: transparent;
      color: ${textSecondary};
    }
    .llm-ci-send--active {
      background: ${text};
      color: ${bg};
      border-color: ${text};
    }
    .llm-ci-send--active:hover {
      opacity: 0.8;
    }
    .llm-ci-send--disabled {
      color: ${textMuted};
      border-color: ${d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
      cursor: not-allowed;
    }
    .llm-ci-send--stop {
      background: transparent;
      border-color: ${border};
      color: ${textSecondary};
    }
    .llm-ci-send--stop:hover {
      border-color: ${borderFocus};
      color: ${text};
    }

    /* Model Selector Slot */
    .llm-ci-model-selector {
      margin-right: auto;
    }

    /* Hidden file input */
    .llm-ci-file-input {
      display: none;
    }

    /* Drag Overlay */
    .llm-ci-drag-overlay {
      position: absolute;
      inset: 0;
      background: ${d ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'};
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border: 1px dashed ${textSecondary};
      color: ${textSecondary};
      font-size: 11px;
      font-family: ${monoFont};
      text-transform: uppercase;
      letter-spacing: 0.08em;
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
}: ChatInputProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) return;
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
          }
          
          const newText = `[Extracted from ${file.name}]\n${fullText}`;
          onChange(value ? `${value}\n\n${newText}` : newText);
        } catch (err) {
          console.error('Error extracting PDF:', err);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

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
  }, [onImageAdd, onChange, value]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) processFile(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
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
          [Drop image to attach]
        </div>
      )}

      {/* Hidden file input for click-to-upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="llm-ci-file-input"
        onChange={handleFileSelect}
      />

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
            onClick={() => fileInputRef.current?.click()}
            title="Attach image (or Ctrl+V to paste)"
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
