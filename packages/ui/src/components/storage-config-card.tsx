import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

export interface StorageConfigCardProps {
  storageType: string;
  onStorageTypeChange: (type: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  s3Bucket: string;
  onS3BucketChange: (value: string) => void;
  s3Endpoint: string;
  onS3EndpointChange: (value: string) => void;
  s3AccessKeyId: string;
  onS3AccessKeyIdChange: (value: string) => void;
  s3SecretAccessKey: string;
  onS3SecretAccessKeyChange: (value: string) => void;
  s3Region: string;
  onS3RegionChange: (value: string) => void;
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';
  onTestConnection: () => void;
}

export function StorageConfigCard({
  storageType,
  onStorageTypeChange,
  url,
  onUrlChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  s3Bucket,
  onS3BucketChange,
  s3Endpoint,
  onS3EndpointChange,
  s3AccessKeyId,
  onS3AccessKeyIdChange,
  s3SecretAccessKey,
  onS3SecretAccessKeyChange,
  s3Region,
  onS3RegionChange,
  connectionStatus,
  onTestConnection,
}: StorageConfigCardProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Configuration</CardTitle>
        <CardDescription>Configure your storage backend for data synchronization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="block mb-4">Storage Type</Label>
          <RadioGroup
            value={storageType}
            onValueChange={(v) => onStorageTypeChange(v)}
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
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => onUsernameChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
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
                onChange={(e) => onS3EndpointChange(e.target.value)}
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
                onChange={(e) => onS3RegionChange(e.target.value)}
                placeholder="us-east-1"
              />
            </div>
            <div className="space-y-2">
              <Label>Bucket</Label>
              <Input
                value={s3Bucket}
                onChange={(e) => onS3BucketChange(e.target.value)}
                placeholder="my-bucket"
              />
            </div>
            <div className="space-y-2">
              <Label>Access Key ID</Label>
              <Input
                value={s3AccessKeyId}
                onChange={(e) => onS3AccessKeyIdChange(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Access Key</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={s3SecretAccessKey}
                  onChange={(e) => onS3SecretAccessKeyChange(e.target.value)}
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
          <Button onClick={onTestConnection} disabled={connectionStatus === 'testing'}>
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
  );
}
