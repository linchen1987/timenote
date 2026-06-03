import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

export type ProviderFormState = {
  scheme: 'webdav' | 's3';
  webdav: { url: string; username: string; password: string };
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
};

export const emptyProviderForm: ProviderFormState = {
  scheme: 'webdav',
  webdav: { url: 'https://dav.jianguoyun.com/dav/', username: '', password: '' },
  s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '' },
};

export interface ProviderFormProps {
  form: ProviderFormState;
  onFormChange: (form: ProviderFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';
}

export function ProviderForm({
  form,
  onFormChange,
  onSave,
  onCancel,
  onTest,
  connectionStatus,
}: ProviderFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const setWebdav = (patch: Partial<ProviderFormState['webdav']>) => {
    onFormChange({ ...form, webdav: { ...form.webdav, ...patch } });
  };

  const setS3 = (patch: Partial<ProviderFormState['s3']>) => {
    onFormChange({ ...form, s3: { ...form.s3, ...patch } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="block mb-4">Type</Label>
          <RadioGroup
            value={form.scheme}
            onValueChange={(v) => {
              onFormChange({ ...form, scheme: v as 'webdav' | 's3' });
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="webdav" id="add-webdav" />
              <Label htmlFor="add-webdav">WebDAV</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="s3" id="add-s3" />
              <Label htmlFor="add-s3">S3 Compatible</Label>
            </div>
          </RadioGroup>
        </div>

        {form.scheme === 'webdav' && (
          <>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={form.webdav.url}
                onChange={(e) => setWebdav({ url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.webdav.username}
                onChange={(e) => setWebdav({ username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.webdav.password}
                  onChange={(e) => setWebdav({ password: e.target.value })}
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

        {form.scheme === 's3' && (
          <>
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Input
                value={form.s3.endpoint}
                onChange={(e) => setS3({ endpoint: e.target.value })}
                placeholder="https://s3.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Input
                value={form.s3.region}
                onChange={(e) => setS3({ region: e.target.value })}
                placeholder="us-east-1"
              />
            </div>
            <div className="space-y-2">
              <Label>Bucket</Label>
              <Input
                value={form.s3.bucket}
                onChange={(e) => setS3({ bucket: e.target.value })}
                placeholder="my-bucket"
              />
            </div>
            <div className="space-y-2">
              <Label>Access Key ID</Label>
              <Input
                value={form.s3.accessKeyId}
                onChange={(e) => setS3({ accessKeyId: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Access Key</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.s3.secretAccessKey}
                  onChange={(e) => setS3({ secretAccessKey: e.target.value })}
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

        <div className="flex gap-3 pt-2">
          <Button onClick={onTest} disabled={connectionStatus === 'testing'}>
            {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button onClick={onSave}>Save Provider</Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
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
