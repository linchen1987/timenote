'use client';

import { AlertCircle, ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useLocalStorage } from '~/hooks/use-local-storage';
import { STORAGE_KEYS } from '~/lib/constants';
import { DataToolsService } from '~/lib/services/data-tools-service';
import { WebDAVService } from '~/lib/services/webdav-service';
import { parseNotebookId } from '~/lib/utils/token';

export default function NotebookSettingsPage() {
  const { notebookToken } = useParams();
  const nbId = parseNotebookId(notebookToken || '');

  const [url, setUrl] = useLocalStorage(STORAGE_KEYS.WEBDAV_URL, 'https://dav.jianguoyun.com/dav/');
  const [username, setUsername] = useLocalStorage(STORAGE_KEYS.WEBDAV_USERNAME, '');
  const [password, setPassword] = useLocalStorage(STORAGE_KEYS.WEBDAV_PASSWORD, '');

  const [showPassword, setShowPassword] = useState(false);
  const [webdavStatus, setWebdavStatus] = useState<'idle' | 'testing' | 'success' | 'error'>(
    'idle',
  );

  const [isClearingSyncEvents, setIsClearingSyncEvents] = useState(false);
  const [isPruningTags, setIsPruningTags] = useState(false);

  const handleTestConnection = async () => {
    setWebdavStatus('testing');
    try {
      const exists = await WebDAVService.exists('/');
      if (exists) {
        setWebdavStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error('Could not connect to root');
      }
    } catch (e) {
      setWebdavStatus('error');
      toast.error('Connection failed');
      console.error(e);
    }
  };

  const clearSyncEvents = async () => {
    setIsClearingSyncEvents(true);
    try {
      await DataToolsService.clearSyncEvents(nbId);
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
      await DataToolsService.pruneTags(nbId);
      toast.success('Orphaned tags pruned successfully');
    } catch (error) {
      console.error('Prune tags failed:', error);
      toast.error('Prune failed');
    } finally {
      setIsPruningTags(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Link to={`/s/${notebookToken}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Notebook Settings</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>WebDAV Configuration</CardTitle>
            <CardDescription>
              Configure your WebDAV server for data synchronization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <Eye className="w-4 h-4 text-zinc-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleTestConnection} disabled={webdavStatus === 'testing'}>
                {webdavStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {webdavStatus === 'success' && (
              <div className="p-3 bg-green-100 text-green-700 rounded flex items-center gap-2 text-sm">
                <Check className="w-4 h-4" /> Connected successfully
              </div>
            )}

            {webdavStatus === 'error' && (
              <div className="p-3 bg-red-100 text-red-700 rounded flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" /> Connection failed
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Tools for maintaining and managing this notebook's data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="h-px bg-border" />

            <div className="space-y-4">
              <h3 className="font-medium">Clear All SyncEvents</h3>
              <p className="text-sm text-muted-foreground">
                Delete all records from the <code>syncEvents</code> table for this notebook.
              </p>
              <Button onClick={clearSyncEvents} disabled={isClearingSyncEvents}>
                {isClearingSyncEvents ? 'Clearing...' : 'Clear SyncEvents'}
              </Button>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <h3 className="font-medium">Prune Tags</h3>
              <p className="text-sm text-muted-foreground">
                Delete tags that are not associated with any notes. This removes orphaned tags from
                the <code>tags</code> table for this notebook.
              </p>
              <Button onClick={pruneTags} disabled={isPruningTags}>
                {isPruningTags ? 'Pruning...' : 'Prune Tags'}
              </Button>
            </div>

            <div className="h-px bg-border" />

            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={`/s/${notebookToken}`}>Back to Notebook</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
