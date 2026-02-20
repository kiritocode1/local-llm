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
      className={`relative flex flex-col bg-[#fafafa] dark:bg-black border-2 border-black dark:border-white rounded-none focus-within:ring-0 focus-within:border-black dark:focus-within:border-white transition-none p-4 font-mono ${className}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-x-0 inset-y-0 bg-[#fafafa]/90 dark:bg-black/90 flex flex-col items-center justify-center z-20 border-4 border-dashed border-black dark:border-white rounded-none mx-2 my-2">
          <ImagePlus className="w-10 h-10 text-black dark:text-white mb-4" />
          <span className="text-black dark:text-white font-bold tracking-widest uppercase text-lg">Drop file to attach</span>
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
        <div className="flex flex-wrap gap-3 mb-4 px-2 mt-2">
          {images.map((img) => (
            <div key={img.id} className="relative w-20 h-20 overflow-hidden border-2 border-black dark:border-white rounded-none group select-none">
              <img src={img.dataUrl} alt="attachment" className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0" />
              <button 
                type="button"
                className="absolute top-0 right-0 w-6 h-6 bg-black text-white dark:bg-white dark:text-black border-l-2 border-b-2 border-black dark:border-white rounded-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-none"
                onClick={() => onImageRemove?.(img.id)}
              >
                <X className="w-4 h-4" />
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
        className="w-full min-h-[24px] max-h-[200px] resize-none border-none outline-none bg-transparent text-black dark:text-white text-base font-mono leading-relaxed px-2 py-1 m-0 placeholder:text-black/30 dark:placeholder:text-white/30 placeholder:uppercase placeholder:tracking-widest scrollbar-thin scrollbar-thumb-black dark:scrollbar-thumb-white scrollbar-track-transparent"
      />

      <div className="flex items-end justify-between mt-6 px-2">
        <div className="flex items-center gap-3">
          {modelSelector && (
            <div className="mr-2">
              {modelSelector}
            </div>
          )}
          
          <button 
            type="button" 
            className="flex items-center justify-center w-10 h-10 border-2 border-black dark:border-white rounded-none text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or PDF (Ctrl+V to paste)"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          
          {actions}
        </div>

        <div className="flex items-center gap-3">
          {isGenerating ? (
            <button
              type="button"
              className="flex items-center justify-center h-10 px-6 rounded-none border-2 border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white font-bold uppercase tracking-widest transition-colors gap-2 cursor-pointer shadow-none"
              onClick={onStop}
            >
              <Square className="w-4 h-4 fill-current" /> STOP
            </button>
          ) : (
            <button
              type="button"
              className={`flex items-center justify-center h-10 px-6 rounded-none border-2 font-bold uppercase tracking-widest transition-none gap-2 ${
                canSend 
                  ? 'border-black dark:border-white bg-black dark:bg-white text-[#fafafa] dark:text-black hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white cursor-pointer' 
                  : 'border-black/20 dark:border-white/20 bg-transparent text-black/20 dark:text-white/20 cursor-not-allowed'
              }`}
              onClick={onSend}
              disabled={!canSend}
            >
              SEND <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
