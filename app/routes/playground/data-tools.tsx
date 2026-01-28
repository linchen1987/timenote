'use client';

import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { DataToolsService } from '~/lib/services/data-tools-service';

export default function DataToolsPage() {
  const [isClearingSyncEvents, setIsClearingSyncEvents] = useState(false);
  const [isPruningTags, setIsPruningTags] = useState(false);

  const clearSyncEvents = async () => {
    setIsClearingSyncEvents(true);
    try {
      await DataToolsService.clearSyncEvents(undefined);
      toast.success('SyncEvents cleared');
    } catch (error) {
      console.error('Clear syncEvents failed:', error);
      toast.error('Clear failed');
    } finally {
      setIsClearingSyncEvents(false);
    }
  };

  const pruneTags = async () => {
    setIsPruningTags(true);
    try {
      await DataToolsService.pruneTags(undefined);
      toast.success('Orphaned tags pruned successfully');
    } catch (error) {
      console.error('Prune tags failed:', error);
      toast.error('Prune failed');
    } finally {
      setIsPruningTags(false);
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
            <CardTitle>Clear All SyncEvents</CardTitle>
            <CardDescription>
              Delete all records from the <code>syncEvents</code> table.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <Button onClick={clearSyncEvents} disabled={isClearingSyncEvents}>
                {isClearingSyncEvents ? 'Clearing...' : 'Clear SyncEvents'}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/playground">Back to Playground</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prune Tags</CardTitle>
            <CardDescription>
              Delete tags that are not associated with any notes. This removes orphaned tags from
              the <code>tags</code> table.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <Button onClick={pruneTags} disabled={isPruningTags}>
                {isPruningTags ? 'Pruning...' : 'Prune Tags'}
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
