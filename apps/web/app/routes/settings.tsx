import { STORAGE_KEYS, useLocalStorage } from '@timenote/core';
import { Button, StorageConfigCard } from '@timenote/ui';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { FsService, type StorageType } from '~/lib/fs-service';

export default function SettingsPage() {
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

  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleStorageTypeChange = (type: string) => {
    setStorageType(type);
    FsService.setStorageType(type as StorageType);
    setStatus('idle');
  };

  const handleTestConnection = async () => {
    setStatus('testing');
    try {
      FsService.clearCache();
      const exists = await FsService.exists('/');
      if (exists) {
        setStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error('Could not connect to root');
      }
    } catch (e) {
      setStatus('error');
      toast.error('Connection failed');
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Link to="/" prefetch="intent">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </header>

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
          connectionStatus={status}
          onTestConnection={handleTestConnection}
        />
      </div>
    </div>
  );
}
