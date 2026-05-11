import {
  getDefaultRemotePath,
  getRemote as getRemoteConfig,
  listProviders,
  type ProviderConfig,
  parseNotebookId,
} from '@timenote/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '../page-header';
import { RemoteConfigCard } from '../remote-config-card';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { UseVaultStoreHook } from './use-notebooks-page';

export interface NotebookSettingsPageProps {
  useVaultStore: UseVaultStoreHook;
  notebookToken: string;
}

export function NotebookSettingsPage({ useVaultStore, notebookToken }: NotebookSettingsPageProps) {
  const projectId = notebookToken ? parseNotebookId(notebookToken) : null;

  const [providers] = useState<ProviderConfig[]>(() => listProviders());
  const [remoteConfig, setRemoteConfig] = useState<{
    providerId: string;
    path: string;
    enabled: boolean;
  } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [customPath, setCustomPath] = useState('');

  const defaultPath = projectId ? getDefaultRemotePath(projectId) : '';

  useEffect(() => {
    if (!projectId) return;
    const entry = getRemoteConfig(projectId);
    if (entry) {
      setRemoteConfig({ providerId: entry.providerId, path: entry.path, enabled: entry.enabled });
      setSelectedProviderId(entry.providerId);
      setCustomPath(entry.path);
    } else {
      setCustomPath(defaultPath);
    }
  }, [projectId, defaultPath]);

  const store = useVaultStore;

  const handleSave = () => {
    if (!projectId || !selectedProviderId) return;
    try {
      store.getState().configureRemote(projectId, selectedProviderId, customPath || undefined);
      setRemoteConfig({
        providerId: selectedProviderId,
        path: customPath || defaultPath,
        enabled: true,
      });
      toast.success('Remote configured');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const handleToggle = () => {
    if (!projectId || !remoteConfig) return;
    try {
      store.getState().toggleRemote(projectId);
      setRemoteConfig({ ...remoteConfig, enabled: !remoteConfig.enabled });
      toast.success(remoteConfig.enabled ? 'Remote disabled' : 'Remote enabled');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const handleDisconnect = () => {
    if (!projectId) return;
    try {
      store.getState().removeRemote(projectId);
      setRemoteConfig(null);
      setSelectedProviderId('');
      setCustomPath(defaultPath);
      toast.success('Remote disconnected');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <PageHeader title="Settings" />

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8">
        <div className="space-y-6">
          <RemoteConfigCard
            providers={providers}
            remoteConfig={remoteConfig}
            selectedProviderId={selectedProviderId}
            customPath={customPath}
            defaultPath={defaultPath}
            onSelectedProviderChange={(id) => {
              setSelectedProviderId(id);
              if (!customPath || customPath.startsWith('timenote/vaults/')) {
                setCustomPath(defaultPath);
              }
            }}
            onCustomPathChange={setCustomPath}
            onSave={handleSave}
            onToggle={handleToggle}
            onDisconnect={handleDisconnect}
            onAddProvider={() => {}}
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
                <Link to={`/s/${notebookToken}`}>Back to Notebook</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
