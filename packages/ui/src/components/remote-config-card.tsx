import type { FsVolumeCredential } from '@timenote/core';
import { Check, Cloud, CloudOff } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };

export interface RemoteDisplayConfig {
  providerId: string;
  path: string;
  enabled: boolean;
}

export interface RemoteConfigCardProps {
  providers: VolumeCredentialEntry[];
  remoteConfig: RemoteDisplayConfig | null;
  selectedProviderId: string;
  customPath: string;
  defaultPath: string;
  onSelectedProviderChange: (id: string) => void;
  onCustomPathChange: (path: string) => void;
  onSave: () => void;
  onToggle: () => void;
  onDisconnect: () => void;
  onAddProvider: () => void;
}

export function RemoteConfigCard({
  providers,
  remoteConfig,
  selectedProviderId,
  customPath,
  defaultPath,
  onSelectedProviderChange,
  onCustomPathChange,
  onSave,
  onToggle,
  onDisconnect,
  onAddProvider,
}: RemoteConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {remoteConfig?.enabled ? (
            <Cloud className="w-5 h-5 text-blue-500" />
          ) : (
            <CloudOff className="w-5 h-5 text-muted-foreground" />
          )}
          Remote Sync
        </CardTitle>
        <CardDescription>Configure remote storage endpoint for this notebook.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {remoteConfig ? (
          <>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm truncate">{remoteConfig.providerId}</p>
                <p className="text-xs text-muted-foreground">{remoteConfig.path}</p>
              </div>
              <Button variant="outline" size="sm" onClick={onToggle}>
                {remoteConfig.enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onDisconnect}>
                Disconnect
              </Button>
            </div>
          </>
        ) : providers.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No storage providers configured.</p>
            <Button variant="outline" onClick={onAddProvider}>
              Add Provider in Settings
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Provider</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProviderId}
                onChange={(e) => onSelectedProviderChange(e.target.value)}
              >
                <option value="">Select a provider...</option>
                {providers.map((p) => (
                  <option key={p.volumeUrl} value={p.volumeUrl}>
                    {p.volumeUrl}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Path</Label>
              <Input
                value={customPath}
                onChange={(e) => onCustomPathChange(e.target.value)}
                placeholder={defaultPath}
              />
              <p className="text-xs text-muted-foreground">
                Path relative to the provider root. Defaults to {defaultPath}
              </p>
            </div>

            <Button onClick={onSave} disabled={!selectedProviderId}>
              <Check className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
