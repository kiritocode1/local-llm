import * as React from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import { Send, Square, ImagePlus, X, Paperclip } from 'lucide-react';

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
  theme?: 'dark' | 'light';
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
  theme = 'dark',
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
      className={`relative flex flex-col bg-transparent border border-current/50 rounded-none transition-colors p-4 font-mono ${className}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={`absolute inset-x-0 inset-y-0 flex flex-col items-center justify-center z-20 backdrop-blur-sm transition-colors ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-black/10 text-black'}`}>
          <span className="font-light tracking-[0.2em] uppercase text-xs">DROP FILE TO ATTACH</span>
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
        <div className="flex flex-wrap gap-2 mb-6">
          {images.map((img) => (
            <div key={img.id} className="relative w-16 h-16 overflow-hidden border border-current/20 rounded-none group select-none">
              <img src={img.dataUrl} alt="attachment" className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0" />
              <button 
                type="button"
                className={`absolute top-0 right-0 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] ${theme === 'dark' ? 'bg-black/80 text-white' : 'bg-white/80 text-black'}`}
                onClick={() => onImageRemove?.(img.id)}
              >
                [X]
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
        className="w-full min-h-[24px] max-h-[200px] resize-none border-none outline-none bg-transparent text-current text-[13px] font-light font-mono leading-relaxed p-0 m-0 placeholder:text-current placeholder:opacity-30 placeholder:uppercase placeholder:tracking-[0.2em] scrollbar-none"
      />

      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-3 flex-wrap">
          {modelSelector && (
            <div>
              {modelSelector}
            </div>
          )}
          
          <button 
            type="button" 
            className="group flex items-center justify-center gap-2 px-4 py-2 rounded border bg-transparent border-current/20 text-current hover:bg-current/5 transition-all duration-300"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or PDF (Ctrl+V to paste)"
          >
            <Paperclip className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">[ FILE ]</span>
            <span className="text-[9px] opacity-40 group-hover:opacity-60 transition-opacity tracking-widest whitespace-nowrap">ファイル</span>
          </button>
          
          {actions}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isGenerating ? (
            <button
              type="button"
              className="group flex items-center justify-center gap-2 px-4 py-2 rounded border bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 transition-all duration-300"
              onClick={onStop}
            >
              <Square className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">[ STOP ]</span>
              <span className="text-[9px] opacity-40 group-hover:opacity-60 transition-opacity tracking-widest whitespace-nowrap">停止</span>
            </button>
          ) : (
            <button
              type="button"
              className={`group flex items-center justify-center gap-2 px-5 py-2 rounded transition-all duration-300 ${
                canSend 
                  ? (theme === 'dark' ? 'bg-[#fafafa] text-black border hover:opacity-80' : 'bg-black text-[#fafafa] border hover:opacity-80') 
                  : (theme === 'dark' ? 'bg-[#fafafa]/10 text-[#fafafa]/40 cursor-not-allowed border border-transparent' : 'bg-black/10 text-black/40 cursor-not-allowed border border-transparent')
              }`}
              onClick={onSend}
              disabled={!canSend}
            >
              <Send className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">[ SEND ]</span>
              <span className="text-[9px] opacity-40 group-hover:opacity-60 transition-opacity tracking-widest whitespace-nowrap">送信</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
