import { STORAGE_KEYS } from '@timenote/core';
import { Button, Input, Label, RadioGroup, RadioGroupItem } from '@timenote/ui';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { StorageType } from '../../lib/fs-service';
import { setStorageType } from '../../lib/fs-service';
import { ExtensionStorage } from '../../lib/storage';

export function Settings() {
  const [storageType, setStorageTypeState] = useState<StorageType>('webdav');
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [s3Region, setS3Region] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useState(() => {
    const load = async () => {
      const type =
        ((await ExtensionStorage.get(STORAGE_KEYS.STORAGE_TYPE)) as StorageType) || 'webdav';
      setStorageTypeState(type);
      setWebdavUrl((await ExtensionStorage.get(STORAGE_KEYS.WEBDAV_URL)) || '');
      setWebdavUsername((await ExtensionStorage.get(STORAGE_KEYS.WEBDAV_USERNAME)) || '');
      setWebdavPassword((await ExtensionStorage.get(STORAGE_KEYS.WEBDAV_PASSWORD)) || '');
      setS3Bucket((await ExtensionStorage.get(STORAGE_KEYS.S3_BUCKET)) || '');
      setS3Endpoint((await ExtensionStorage.get(STORAGE_KEYS.S3_ENDPOINT)) || '');
      setS3AccessKeyId((await ExtensionStorage.get(STORAGE_KEYS.S3_ACCESS_KEY_ID)) || '');
      setS3SecretAccessKey((await ExtensionStorage.get(STORAGE_KEYS.S3_SECRET_ACCESS_KEY)) || '');
      setS3Region((await ExtensionStorage.get(STORAGE_KEYS.S3_REGION)) || '');
    };
    load();
  });

  const handleSave = async () => {
    try {
      setError('');
      await setStorageType(storageType);

      if (storageType === 'webdav') {
        if (!webdavUrl) {
          setError('请填写 WebDAV URL');
          return;
        }
        await ExtensionStorage.set(STORAGE_KEYS.WEBDAV_URL, webdavUrl);
        await ExtensionStorage.set(STORAGE_KEYS.WEBDAV_USERNAME, webdavUsername);
        await ExtensionStorage.set(STORAGE_KEYS.WEBDAV_PASSWORD, webdavPassword);
      } else {
        if (!s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
          setError('请填写 S3 必填项');
          return;
        }
        await ExtensionStorage.set(STORAGE_KEYS.S3_BUCKET, s3Bucket);
        await ExtensionStorage.set(STORAGE_KEYS.S3_ENDPOINT, s3Endpoint);
        await ExtensionStorage.set(STORAGE_KEYS.S3_ACCESS_KEY_ID, s3AccessKeyId);
        await ExtensionStorage.set(STORAGE_KEYS.S3_SECRET_ACCESS_KEY, s3SecretAccessKey);
        await ExtensionStorage.set(STORAGE_KEYS.S3_REGION, s3Region);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  };

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-medium">同步设置</h3>

      <RadioGroup
        value={storageType}
        onValueChange={(v) => setStorageTypeState(v as StorageType)}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="webdav" id="webdav" />
          <Label htmlFor="webdav" className="text-sm">
            WebDAV
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="s3" id="s3" />
          <Label htmlFor="s3" className="text-sm">
            S3
          </Label>
        </div>
      </RadioGroup>

      {storageType === 'webdav' ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL</Label>
            <Input
              placeholder="https://dav.example.com/path"
              value={webdavUrl}
              onChange={(e) => setWebdavUrl(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">用户名</Label>
            <Input
              value={webdavUsername}
              onChange={(e) => setWebdavUsername(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">密码</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={webdavPassword}
                onChange={(e) => setWebdavPassword(e.target.value)}
                className="h-8 text-sm pr-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Bucket</Label>
            <Input
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Endpoint</Label>
            <Input
              placeholder="https://s3.example.com"
              value={s3Endpoint}
              onChange={(e) => setS3Endpoint(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Access Key ID</Label>
            <Input
              value={s3AccessKeyId}
              onChange={(e) => setS3AccessKeyId(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Secret Access Key</Label>
            <Input
              type="password"
              value={s3SecretAccessKey}
              onChange={(e) => setS3SecretAccessKey(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Region</Label>
            <Input
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <Button onClick={handleSave} className="w-full h-8 text-sm" disabled={!!saved}>
        {saved ? (
          <>
            <Check className="h-3 w-3 mr-1" />
            已保存
          </>
        ) : (
          '保存设置'
        )}
      </Button>
    </div>
  );
}
