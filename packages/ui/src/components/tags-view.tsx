import { ChevronRight, Hash, Tag as TagIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export interface TagWithCount {
  name: string;
  count: number;
}

export interface TagsViewProps {
  tags: TagWithCount[];
  loading?: boolean;
  prefetch?: 'intent' | 'none';
}

export function TagsView({ tags, loading, prefetch = 'none' }: TagsViewProps) {
  const { notebookToken } = useParams();
  const navigate = useNavigate();

  const handleSelectTag = (tagName: string) => {
    navigate(`/s/${notebookToken}?q=${encodeURIComponent(`#${tagName}`)}`);
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Tags" />
        <div className="flex items-center justify-center py-32">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tags" />

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <Card
              key={tag.name}
              className="group hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => handleSelectTag(tag.name)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">#{tag.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {tag.count} {tag.count === 1 ? 'note' : 'notes'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}

          {tags.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <TagIcon className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold">No tags found</h3>
              <p className="text-muted-foreground">
                Tags will appear here once you add them to your notes using the # symbol.
              </p>
              <Button variant="outline" className="mt-6" asChild>
                <Link to={`/s/${notebookToken}`} prefetch={prefetch}>
                  Go to Timeline
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
