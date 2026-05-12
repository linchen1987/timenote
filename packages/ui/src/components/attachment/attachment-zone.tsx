import type { AttachmentRef, EditAttachment, PendingAttachment } from '@timenote/core';
import { ImagePlus, Paperclip, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

function isPendingAttachment(a: EditAttachment): a is PendingAttachment {
  return a.type === 'pending';
}

interface AttachmentPreviewProps {
  path: string;
  name: string;
  imageUrl?: string;
  onDelete?: () => void;
}

function AttachmentPreview({ path, name, imageUrl, onDelete }: AttachmentPreviewProps) {
  const isImage = isImagePath(path);

  if (isImage) {
    return (
      <div className="relative group rounded-lg overflow-hidden bg-muted/30 border border-muted/40 aspect-square flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative group flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-muted/40">
      <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground truncate">{name}</span>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-0.5 rounded-full hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      )}
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

  if (attachments.length === 0 && !editable) return null;

  if (attachments.length === 0 && editable && !onAdd) return null;

  if (attachments.length === 0 && editable && onAdd) {
    return (
      <>
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
      </>
    );
  }

  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-muted/20">
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map((att, idx) => (
            <AttachmentPreview
              key={att.path}
              path={att.path}
              name={att.name || att.path.split('/').pop() || ''}
              imageUrl={imageUrls[att.path]}
              onDelete={editable && onRemove ? () => onRemove(idx) : undefined}
            />
          ))}
        </div>
      )}

      {editable && onAdd && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="w-4 h-4 mr-1" />
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
