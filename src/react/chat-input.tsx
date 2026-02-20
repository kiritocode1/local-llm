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
      className={`relative flex flex-col bg-black border border-white/30 rounded-none focus-within:border-white/60 transition-colors p-3 font-mono ${className}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-x-0 inset-y-0 bg-black/90 flex flex-col items-center justify-center z-20 border border-dashed border-white/50 rounded-none m-1">
          <ImagePlus className="w-8 h-8 text-white mb-2" />
          <span className="text-white font-light tracking-widest uppercase text-xs">Drop file to attach</span>
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
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((img) => (
            <div key={img.id} className="relative w-16 h-16 overflow-hidden border border-white/30 rounded-none group select-none">
              <img src={img.dataUrl} alt="attachment" className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0" />
              <button 
                type="button"
                className="absolute top-0 right-0 w-5 h-5 bg-black/80 text-white border-l border-b border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
        className="w-full min-h-[24px] max-h-[200px] resize-none border-none outline-none bg-transparent text-white text-sm font-light font-mono leading-relaxed p-0 m-0 placeholder:text-white/30 placeholder:uppercase placeholder:tracking-widest scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
      />

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          {modelSelector && (
            <div className="mr-2">
              {modelSelector}
            </div>
          )}
          
          <button 
            type="button" 
            className="flex items-center justify-center w-8 h-8 rounded-none text-white/50 hover:text-white transition-colors"
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
              className="flex items-center justify-center h-8 px-4 rounded-none border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-light text-[10px] uppercase tracking-widest transition-colors gap-2 cursor-pointer"
              onClick={onStop}
            >
              <Square className="w-3 h-3 fill-current" /> STOP
            </button>
          ) : (
            <button
              type="button"
              className={`flex items-center justify-center h-8 px-4 rounded-none border text-[10px] font-light uppercase tracking-widest transition-colors gap-2 ${
                canSend 
                  ? 'border-white/30 bg-transparent text-white hover:bg-white hover:text-black cursor-pointer' 
                  : 'border-white/10 bg-transparent text-white/20 cursor-not-allowed'
              }`}
              onClick={onSend}
              disabled={!canSend}
            >
              SEND
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
