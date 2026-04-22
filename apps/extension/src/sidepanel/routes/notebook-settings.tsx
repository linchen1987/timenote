import { DataToolsService, parseNotebookId, STORAGE_KEYS } from '@timenote/core';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  StorageConfigCard,
} from '@timenote/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { FsService, type StorageType } from '../../lib/fs-service';
import { useChromeStorage } from '../../lib/use-chrome-storage';

export function NotebookSettings() {
  const { notebookToken } = useParams();
  const nbId = parseNotebookId(notebookToken || '');

  const [storageType, setStorageType] = useChromeStorage(
    STORAGE_KEYS.STORAGE_TYPE,
    'webdav' as StorageType,
  );

  const [url, setUrl] = useChromeStorage(
    STORAGE_KEYS.WEBDAV_URL,
    'https://dav.jianguoyun.com/dav/',
  );
  const [username, setUsername] = useChromeStorage(STORAGE_KEYS.WEBDAV_USERNAME, '');
  const [password, setPassword] = useChromeStorage(STORAGE_KEYS.WEBDAV_PASSWORD, '');

  const [s3Bucket, setS3Bucket] = useChromeStorage(STORAGE_KEYS.S3_BUCKET, '');
  const [s3Endpoint, setS3Endpoint] = useChromeStorage(STORAGE_KEYS.S3_ENDPOINT, '');
  const [s3AccessKeyId, setS3AccessKeyId] = useChromeStorage(STORAGE_KEYS.S3_ACCESS_KEY_ID, '');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useChromeStorage(
    STORAGE_KEYS.S3_SECRET_ACCESS_KEY,
    '',
  );
  const [s3Region, setS3Region] = useChromeStorage(STORAGE_KEYS.S3_REGION, '');

  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

  const [isClearingSyncEvents, setIsClearingSyncEvents] = useState(false);
  const [isPruningTags, setIsPruningTags] = useState(false);

  const handleStorageTypeChange = (type: string) => {
    setStorageType(type);
    FsService.setStorageType(type as StorageType);
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
          <StorageConfigCard
            storageType={storageType}
            onStorageTypeChange={handleStorageTypeChange}
            url={url}
            onUrlChange={setUrl}
            username={username}
            onUsernameChange={setUsername}
            password={password}
            onPasswordChange={setPassword}
            s3Bucket={s3Bucket}
            onS3BucketChange={setS3Bucket}
            s3Endpoint={s3Endpoint}
            onS3EndpointChange={setS3Endpoint}
            s3AccessKeyId={s3AccessKeyId}
            onS3AccessKeyIdChange={setS3AccessKeyId}
            s3SecretAccessKey={s3SecretAccessKey}
            onS3SecretAccessKeyChange={setS3SecretAccessKey}
            s3Region={s3Region}
            onS3RegionChange={setS3Region}
            connectionStatus={connectionStatus}
            onTestConnection={handleTestConnection}
          />

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
