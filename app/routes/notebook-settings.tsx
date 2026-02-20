'use client';

import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '~/components/page-header';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { useLocalStorage } from '~/hooks/use-local-storage';
import { STORAGE_KEYS } from '~/lib/constants';
import { DataToolsService } from '~/lib/services/data-tools-service';
import { FsService, type StorageType } from '~/lib/services/fs-service';
import { parseNotebookId } from '~/lib/utils/token';
import type { Route } from './+types/notebook-settings';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Settings - TimeNote' }];
};

export default function NotebookSettingsPage() {
  const { notebookToken } = useParams();
  const nbId = parseNotebookId(notebookToken || '');

  const [storageType, setStorageType] = useLocalStorage(
    STORAGE_KEYS.STORAGE_TYPE,
    'webdav' as StorageType,
  );

  const [url, setUrl] = useLocalStorage(STORAGE_KEYS.WEBDAV_URL, 'https://dav.jianguoyun.com/dav/');
  const [username, setUsername] = useLocalStorage(STORAGE_KEYS.WEBDAV_USERNAME, '');
  const [password, setPassword] = useLocalStorage(STORAGE_KEYS.WEBDAV_PASSWORD, '');

  const [s3Bucket, setS3Bucket] = useLocalStorage(STORAGE_KEYS.S3_BUCKET, '');
  const [s3Endpoint, setS3Endpoint] = useLocalStorage(STORAGE_KEYS.S3_ENDPOINT, '');
  const [s3AccessKeyId, setS3AccessKeyId] = useLocalStorage(STORAGE_KEYS.S3_ACCESS_KEY_ID, '');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useLocalStorage(
    STORAGE_KEYS.S3_SECRET_ACCESS_KEY,
    '',
  );
  const [s3Region, setS3Region] = useLocalStorage(STORAGE_KEYS.S3_REGION, '');

  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

  const [isClearingSyncEvents, setIsClearingSyncEvents] = useState(false);
  const [isPruningTags, setIsPruningTags] = useState(false);

  const handleStorageTypeChange = (type: StorageType) => {
    setStorageType(type);
    FsService.setStorageType(type);
    setConnectionStatus('idle');
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    try {
      FsService.clearCache();
      const exists = await FsService.exists('/');
      if (exists) {
        setConnectionStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error('Could not connect to root');
      }
    } catch (e) {
      setConnectionStatus('error');
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
    <>
      <PageHeader title="Settings" />

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage Configuration</CardTitle>
              <CardDescription>
                Configure your storage backend for data synchronization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="block mb-4">Storage Type</Label>
                <RadioGroup
                  value={storageType}
                  onValueChange={(v) => handleStorageTypeChange(v as StorageType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="webdav" id="webdav" />
                    <Label htmlFor="webdav">WebDAV</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="s3" id="s3" />
                    <Label htmlFor="s3">S3 Compatible</Label>
                  </div>
                </RadioGroup>
              </div>

              {storageType === 'webdav' && (
                <>
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
                </>
              )}

              {storageType === 's3' && (
                <>
                  <div className="space-y-2">
                    <Label>Endpoint</Label>
                    <Input
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.target.value)}
                      placeholder="https://s3.example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for AWS S3, or enter custom endpoint for S3-compatible services.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Input
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="us-east-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bucket</Label>
                    <Input
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.target.value)}
                      placeholder="my-bucket"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Key ID</Label>
                    <Input
                      value={s3AccessKeyId}
                      onChange={(e) => setS3AccessKeyId(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secret Access Key</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={s3SecretAccessKey}
                        onChange={(e) => setS3SecretAccessKey(e.target.value)}
                        className="pr-10"
                        autoComplete="off"
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
                </>
              )}

              <div className="pt-2">
                <Button onClick={handleTestConnection} disabled={connectionStatus === 'testing'}>
                  {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>

              {connectionStatus === 'success' && (
                <div className="p-3 bg-green-100 text-green-700 rounded flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4" /> Connected successfully
                </div>
              )}

              {connectionStatus === 'error' && (
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
                  Delete tags that are not associated with any notes. This removes orphaned tags
                  from the <code>tags</code> table for this notebook.
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
    </>
  );
}
