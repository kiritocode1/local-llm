import * as React from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import { Send, Square, ImagePlus, X } from 'lucide-react';

export interface ImageAttachment {
  id: string;
  dataUrl: string;
  file: File;
  name: string;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  placeholder?: string;
  maxRows?: number;
  actions?: React.ReactNode;
  className?: string;
  images?: ImageAttachment[];
  onImageAdd?: (image: ImageAttachment) => void;
  onImageRemove?: (id: string) => void;
  modelSelector?: React.ReactNode;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isGenerating = false,
  placeholder = 'Message...',
  maxRows = 8,
  actions,
  className = '',
  images = [],
  onImageAdd,
  onImageRemove,
  modelSelector,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const lineHeight = 24;
    const maxHeight = lineHeight * maxRows + 24;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value, maxRows]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || images.length > 0)) {
        onSend();
      }
    }
  }, [disabled, value, images.length, onSend]);

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
        onImageAdd?.({ id, dataUrl: e.target.result, file, name: file.name });
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
    e.target.value = '';
  }, [processFile]);

  const hasValue = value.trim().length > 0 || images.length > 0;
  const canSend = hasValue && !disabled && !isGenerating;

  return (
    <div 
      className={`relative flex flex-col bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all p-3 ${className}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-white/90 dark:bg-zinc-900/90 flex flex-col items-center justify-center z-20 border-2 border-dashed border-blue-500 rounded-2xl">
          <ImagePlus className="w-8 h-8 text-blue-500 mb-2" />
          <span className="text-blue-500 font-medium tracking-wide">Drop file to attach</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 px-2">
          {images.map((img) => (
            <div key={img.id} className="relative w-14 h-14 overflow-hidden border border-zinc-200 dark:border-zinc-700 rounded-xl group select-none">
              <img src={img.dataUrl} alt="attachment" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <button 
                type="button"
                className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                onClick={() => onImageRemove?.(img.id)}
              >
                <X className="w-3 h-3" />
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
        className="w-full min-h-[24px] max-h-[200px] resize-none border-none outline-none bg-transparent text-zinc-900 dark:text-zinc-100 text-[15px] leading-relaxed px-2 m-0 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700"
      />

      <div className="flex items-end justify-between mt-3 px-1">
        <div className="flex items-center gap-1">
          {modelSelector && (
            <div className="mr-2">
              {modelSelector}
            </div>
          )}
          
          <button 
            type="button" 
            className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or PDF (Ctrl+V to paste)"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          
          {actions}
        </div>

        <div className="flex items-center gap-2">
          {isGenerating ? (
            <button
              type="button"
              className="flex items-center justify-center h-8 px-4 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold tracking-wide transition-colors gap-1.5 cursor-pointer shadow-sm"
              onClick={onStop}
            >
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          ) : (
            <button
              type="button"
              className={`flex items-center justify-center h-8 px-4 rounded-full text-xs font-semibold tracking-wide transition-all gap-1.5 ${
                canSend 
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer' 
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
              }`}
              onClick={onSend}
              disabled={!canSend}
            >
              Send <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
