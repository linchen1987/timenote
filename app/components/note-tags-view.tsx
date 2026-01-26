import { useLiveQuery } from 'dexie-react-hooks';
import { Hash } from 'lucide-react';
import { NoteService } from '~/lib/services/note-service';
import { cn } from '~/lib/utils';

interface NoteTagsViewProps {
  noteId: string;
  className?: string;
  variant?: 'default' | 'subtle';
}

export function NoteTagsView({ noteId, className, variant = 'default' }: NoteTagsViewProps) {
  const noteTags = useLiveQuery(() => NoteService.getTagsForNote(noteId), [noteId]);

  if (!noteTags || noteTags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {noteTags.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            'font-bold rounded-full flex items-center gap-0.5',
            variant === 'default'
              ? 'bg-primary/10 text-primary text-[10px] px-2 py-0.5'
              : 'bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5',
          )}
        >
          <Hash className="w-2.5 h-2.5 opacity-70" />
          {tag.name}
        </span>
      ))}
    </div>
  );
}
