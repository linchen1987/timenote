'use client';

import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { db } from '~/lib/db';

export default function DataToolsPage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const migrateNoteTags = async () => {
    setIsMigrating(true);
    setProgress(0);
    setStatus('Processing...');

    try {
      const allNoteTags = await db.noteTags.toArray();
      const total = allNoteTags.length;

      if (total === 0) {
        setStatus('No records to process.');
        setIsMigrating(false);
        return;
      }

      setStatus(`Found ${total} records. Starting update...`);

      let processed = 0;

      // Use a transaction for better performance
      await db.transaction('rw', [db.noteTags, db.notes], async (tx) => {
        // Mark as sync source to avoid triggering hooks during maintenance
        (tx as any).source = 'sync';

        for (const nt of allNoteTags) {
          if (!nt.notebookId) {
            const note = await db.notes.get(nt.noteId);
            if (note) {
              await db.noteTags.where({ noteId: nt.noteId, tagId: nt.tagId }).modify({
                notebookId: note.notebookId,
              });
            }
          }
          processed++;
          if (processed % 10 === 0 || processed === total) {
            setProgress(Math.round((processed / total) * 100));
            setStatus(`Processed ${processed}/${total}...`);
          }
        }
      });

      setStatus('Task completed successfully!');
      toast.success('Task completed');
    } catch (error) {
      console.error('Operation failed:', error);
      setStatus(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
      toast.error('Operation failed');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Data Tools</h1>
          <p className="text-muted-foreground">
            Raw data operations, maintenance tasks, and database migrations.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Fix Missing notebookId in noteTags</CardTitle>
            <CardDescription>
              Populate the <code>notebookId</code> field in the <code>noteTags</code> table by
              looking up the associated notebook from existing notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{status || 'Ready'}</span>
                {isMigrating && <span>{progress}%</span>}
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={migrateNoteTags} disabled={isMigrating}>
                {isMigrating ? 'Running...' : 'Run Task'}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/playground">Back to Playground</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
