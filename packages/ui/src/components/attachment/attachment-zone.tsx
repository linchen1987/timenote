import type { AttachmentRef, EditAttachment, PendingAttachment } from '@timenote/core';
import { cn } from '@timenote/core';
import { Download, ImagePlus, Paperclip, X, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

function isPendingAttachment(a: EditAttachment): a is PendingAttachment {
  return a.type === 'pending';
}

function ImageLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-none bg-transparent shadow-none p-0 max-w-[95vw] max-h-[95vh] flex items-center justify-center [&>button]:hidden">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img src={src} alt={alt} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

interface AttachmentPreviewProps {
  path: string;
  name: string;
  imageUrl?: string;
  editable: boolean;
  onDelete?: () => void;
  onDownload?: () => void;
}

function AttachmentPreview({
  path,
  name,
  imageUrl,
  editable,
  onDelete,
  onDownload,
}: AttachmentPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = isImagePath(path);

  if (isImage) {
    return (
      <>
        <div className="relative group rounded-md overflow-hidden bg-muted/30 border border-muted/40">
          <div className="aspect-square">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImagePlus className="w-5 h-5 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div
            className={cn(
              'absolute inset-0 bg-black/0 transition-colors',
              'group-hover:bg-black/20',
            )}
          >
            {imageUrl && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="p-1.5 rounded-full bg-black/40 text-white">
                  <ZoomIn className="w-4 h-4" />
                </div>
              </button>
            )}
            {editable && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {lightboxOpen && imageUrl && (
          <ImageLightbox
            src={imageUrl}
            alt={name}
            open={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-muted/40">
      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground truncate min-w-0">{name}</span>
      <div className="flex items-center gap-0.5 shrink-0 ml-auto">
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        {editable && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface AttachmentZoneProps {
  attachments: EditAttachment[];
  editable: boolean;
  getAttachmentUrl?: (path: string) => Promise<string>;
  onAdd?: (files: File[]) => void;
  onRemove?: (index: number) => void;
}

export function AttachmentZone({
  attachments,
  editable,
  getAttachmentUrl,
  onAdd,
  onRemove,
}: AttachmentZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const loadedPathsRef = useRef<Set<string>>(new Set());
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!editable || !onAdd) return;
      const files = Array.from(e.clipboardData?.files || []);
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onAdd(imageFiles);
      }
    },
    [editable, onAdd],
  );

  useEffect(() => {
    if (!editable) return;
    document.addEventListener('paste', handlePaste, true);
    return () => document.removeEventListener('paste', handlePaste, true);
  }, [editable, handlePaste]);

  useEffect(() => {
    const pendingImageAttachments = attachments.filter(
      (a) => isImagePath(a.path) && isPendingAttachment(a) && !loadedPathsRef.current.has(a.path),
    );

    if (pendingImageAttachments.length > 0) {
      const newUrls: Record<string, string> = {};
      for (const a of pendingImageAttachments) {
        if (!loadedPathsRef.current.has(a.path)) {
          loadedPathsRef.current.add(a.path);
          const blob = new Blob([a.data], { type: a.mime || 'image/png' });
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.add(url);
          newUrls[a.path] = url;
        }
      }
      if (Object.keys(newUrls).length > 0) {
        setImageUrls((prev) => ({ ...prev, ...newUrls }));
      }
    }

    if (!getAttachmentUrl) return;
    const existingImagePaths = attachments
      .filter(
        (a) =>
          isImagePath(a.path) && !isPendingAttachment(a) && !loadedPathsRef.current.has(a.path),
      )
      .map((a) => a.path);

    if (existingImagePaths.length === 0) return;

    let cancelled = false;
    Promise.all(
      existingImagePaths.map(async (path) => {
        try {
          const url = await getAttachmentUrl(path);
          return { path, url };
        } catch (err) {
          console.error('[AttachmentZone] Failed to load image:', path, err);
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const newUrls: Record<string, string> = {};
      for (const r of results) {
        if (r) {
          loadedPathsRef.current.add(r.path);
          newUrls[r.path] = r.url;
        }
      }
      if (Object.keys(newUrls).length > 0) {
        setImageUrls((prev) => ({ ...prev, ...newUrls }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attachments, getAttachmentUrl]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const handleDownload = useCallback(
    async (path: string, name: string) => {
      if (!getAttachmentUrl) return;
      try {
        const url = await getAttachmentUrl(path);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('[AttachmentZone] Download failed:', err);
      }
    },
    [getAttachmentUrl],
  );

  if (attachments.length === 0 && !editable) return null;

  if (attachments.length === 0 && editable && !onAdd) return null;

  if (attachments.length === 0 && editable && onAdd) {
    return (
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.zip,.txt,.json"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onAdd(files);
          e.target.value = '';
        }}
      />
    );
  }

  const imageAttachments = attachments.filter((a) => isImagePath(a.path));
  const fileAttachments = attachments.filter((a) => !isImagePath(a.path));

  return (
    <div className="mt-2 pt-2 border-t border-muted/20">
      {imageAttachments.length > 0 && (
        <div
          className={cn(
            'grid gap-1.5',
            imageAttachments.length === 1 && 'grid-cols-1 max-w-[200px]',
            imageAttachments.length === 2 && 'grid-cols-2 max-w-[280px]',
            imageAttachments.length >= 3 && 'grid-cols-3 max-w-[360px]',
          )}
        >
          {imageAttachments.map((att) => {
            const idx = attachments.indexOf(att);
            return (
              <AttachmentPreview
                key={att.path}
                path={att.path}
                name={att.name || att.path.split('/').pop() || ''}
                imageUrl={imageUrls[att.path]}
                editable={editable}
                onDelete={editable && onRemove ? () => onRemove(idx) : undefined}
                onDownload={
                  !isPendingAttachment(att)
                    ? () => handleDownload(att.path, att.name || att.path.split('/').pop() || '')
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {fileAttachments.map((att) => {
            const idx = attachments.indexOf(att);
            return (
              <AttachmentPreview
                key={att.path}
                path={att.path}
                name={att.name || att.path.split('/').pop() || ''}
                editable={editable}
                onDelete={editable && onRemove ? () => onRemove(idx) : undefined}
                onDownload={
                  !isPendingAttachment(att)
                    ? () => handleDownload(att.path, att.name || att.path.split('/').pop() || '')
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      {editable && onAdd && (
        <div className="flex items-center gap-2 mt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground h-7"
          >
            <ImagePlus className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">Add</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.zip,.txt,.json"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) onAdd(files);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}

export function attachmentRefToEditAttachment(refs: AttachmentRef[]): EditAttachment[] {
  return refs.map((ref) => ({
    type: 'existing' as const,
    path: ref.path,
    name: ref.name,
    mime: ref.mime,
    size: ref.size,
  }));
}
