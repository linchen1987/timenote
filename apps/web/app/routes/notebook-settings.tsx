'use client';

import { STORAGE_KEYS, useLocalStorage } from '@timenote/core';
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
import { FsService, type StorageType } from '~/lib/fs-service';
import type { Route } from './+types/notebook-settings';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Settings - TimeNote' }];
};

export default function NotebookSettingsPage() {
  const { notebookToken } = useParams();

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

  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

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
            <CardContent className="space-y-4">
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link to={`/s/${notebookToken}`} prefetch="intent">
                  Back to Notebook
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
