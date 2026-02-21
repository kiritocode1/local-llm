import * as React from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import type { ImageToTextPipeline } from '@huggingface/transformers';

export interface ImageAttachment {
  id: string;
  dataUrl: string;
  file: File;
  name: string;
  extractedText?: string;
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
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 10);
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
          }
          
          const newText = `📄 PDF: ${file.name} (${pdf.numPages} pages total, showing images for first ${maxPages} pages)\n\nExtracted Text:\n${fullText}`;

          if (onImageAdd) {
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport } as any).promise;
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                
                const arr = dataUrl.split(',');
                if (arr.length > 1) {
                  const mimeMatch = arr[0]?.match(/:(.*?);/);
                  const mime = mimeMatch ? mimeMatch[1] : undefined;
                  const base64Data = arr[1];
                  
                  if (mime && base64Data) {
                    const bstr = atob(base64Data);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                      u8arr[n] = bstr.charCodeAt(n);
                    }
                    const imgFile = new File([u8arr], `__PDF__${file.name}__page${i}.jpg`, { type: mime });
                    const id = Math.random().toString(36).substring(7);
                    
                    onImageAdd({ 
                      id, 
                      dataUrl, 
                      file: imgFile, 
                      name: imgFile.name,
                      extractedText: i === 1 ? newText : undefined
                    });
                  }
                }
              }
            }
          } else {
            onChange(value ? `${value}\n\n${newText}` : newText);
          }
        } catch (err) {
          console.error('Error extracting PDF:', err);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
           const id = Math.random().toString(36).substring(7);
           const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
           onImageAdd?.({ 
             id, 
             dataUrl, 
             file, 
             name: file.name,
             extractedText: text
           });
        }
      };
      reader.readAsText(file);
      return;
    }

    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        const id = Math.random().toString(36).substring(7);
        const dataUrl = e.target.result;
        
        // Return instantly to UI! Captioning will happen precisely when user hits send
        onImageAdd?.({ id, dataUrl, file, name: file.name });
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
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">[ SEND ]</span>
              <span className="text-[9px] opacity-40 group-hover:opacity-60 transition-opacity tracking-widest whitespace-nowrap">送信</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
