import { useParams, Link, useNavigate, type MetaFunction } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { NoteService } from "../lib/services/note-service";
import { NotebookSidebar } from "../components/notebook-sidebar";
import { Hash, Tag as TagIcon, ChevronRight } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => {
  return [{ title: "Time Note" }];
};

export default function TagsPage() {
  const { notebookId } = useParams();
  const nbId = notebookId || "";
  const navigate = useNavigate();
  
  const notebook = useLiveQuery(() => NoteService.getNotebook(nbId), [nbId]);
  const tagsWithCounts = useLiveQuery(() => NoteService.getTagsWithCounts(nbId), [nbId]) || [];

  const handleSelectSearch = (query: string) => {
    navigate(`/s/${nbId}?q=${encodeURIComponent(query)}`);
  };

  const handleSelectNote = (noteId: string) => {
    navigate(`/s/${nbId}/${noteId}`);
  };

  if (!notebook) return null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <NotebookSidebar 
        notebookId={nbId} 
        onSelectSearch={handleSelectSearch} 
        onSelectNote={handleSelectNote}
      />
      
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-muted/20 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Tags</h2>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tagsWithCounts.map((tag) => (
              <Card 
                key={tag.id} 
                className="group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => handleSelectSearch(`#${tag.name}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Hash className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">#{tag.name}</div>
                      <div className="text-xs text-muted-foreground">{tag.count} notes</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))}

            {tagsWithCounts.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <TagIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">No tags found</h3>
                <p className="text-muted-foreground">
                  Tags will appear here once you add them to your notes using the # symbol.
                </p>
                <Button variant="outline" className="mt-6" asChild>
                   <Link to={`/s/${nbId}`}>Go to Timeline</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
