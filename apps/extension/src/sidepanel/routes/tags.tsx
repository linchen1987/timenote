import { NoteService } from '@timenote/core';
import { Button } from '@timenote/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';

export function TagsView() {
  const { notebookId } = useParams<{ notebookId: string }>();
  const tags = useLiveQuery(() => NoteService.getTagsWithCounts(notebookId!), [notebookId]);

  return (
    <div className="p-3">
      <h3 className="text-sm font-medium mb-3">标签</h3>
      {tags?.length === 0 && (
        <p className="text-sm text-muted-foreground">在笔记中使用 #标签 来创建标签</p>
      )}
      <div className="flex flex-wrap gap-2">
        {tags?.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-xs"
          >
            #{tag.name}
            <span className="text-muted-foreground">({tag.count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
