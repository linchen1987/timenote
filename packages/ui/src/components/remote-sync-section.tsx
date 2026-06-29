import { cn, type FsVolumeCredential } from '@timenote/core';
import { Check, Cloud, CloudOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };

export interface RemoteDisplayConfig {
  providerId: string;
  path: string;
  enabled: boolean;
}

export interface RemoteSyncSectionProps {
  providers: VolumeCredentialEntry[];
  remoteConfig: RemoteDisplayConfig | null;
  selectedProviderId: string;
  customPath: string;
  defaultPath: string;
  onSelectedProviderChange: (id: string) => void;
  onCustomPathChange: (path: string) => void;
  onSave: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onAddProvider: () => void;
}

function StatusPill({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Paused
    </span>
  );
}

export function RemoteSyncSection({
  providers,
  remoteConfig,
  selectedProviderId,
  customPath,
  defaultPath,
  onSelectedProviderChange,
  onCustomPathChange,
  onSave,
  onToggle,
  onRemove,
  onAddProvider,
}: RemoteSyncSectionProps) {
  const isEnabled = remoteConfig?.enabled === true;
  const fullUrl = remoteConfig
    ? (() => {
        const normalizedPath = (remoteConfig.path ?? '').replace(/^\/+/, '');
        return normalizedPath
          ? `${remoteConfig.providerId}/${normalizedPath}`
          : remoteConfig.providerId;
      })()
    : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Cloud className="w-4 h-4 text-blue-500" />
          ) : (
            <CloudOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Remote Sync</span>
        </div>
        {remoteConfig && <StatusPill enabled={isEnabled} />}
      </div>

      {remoteConfig ? (
        <div className={cn('space-y-3 transition-opacity', !isEnabled && 'opacity-60')}>
          <div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2">
            <p className="font-mono text-sm break-all">{fullUrl}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={isEnabled ? 'secondary' : 'default'} size="sm" onClick={onToggle}>
              {isEnabled ? 'Disable' : 'Enable'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove remote?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the remote storage configuration for this notebook. You'll need to
                    reconfigure the provider and path to sync again. Your local notes are not
                    affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">No storage providers configured.</p>
          <Button variant="outline" size="sm" onClick={onAddProvider}>
            Add Provider in Settings
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
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
        </div>
      )}
    </div>
  );
}
