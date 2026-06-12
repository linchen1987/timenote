import {
  computeVolumeUrl,
  type FsVolumeAccess,
  getDefaultRemotePath,
  parseNotebookId,
  parseVolumeUrl,
} from '@timenote/core';
import { ArrowLeft, Database, Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '../page-header';
import { RemoteConfigCard } from '../remote-config-card';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useExportVault } from './use-export-vault';
import type { UseVaultStoreHook } from './use-notebooks-page';

type VolumeAccessEntry = FsVolumeAccess & { volumeUrl: string };

export interface NotebookSettingsPageProps {
  useVaultStore: UseVaultStoreHook;
  notebookToken: string;
}

export function NotebookSettingsPage({ useVaultStore, notebookToken }: NotebookSettingsPageProps) {
  const projectId = notebookToken ? parseNotebookId(notebookToken) : null;

  const [providers] = useState<VolumeAccessEntry[]>(() =>
    useVaultStore.getState().listVolumeAccesses(),
  );
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
    const store = useVaultStore.getState();
    store.getRemoteConfig(projectId).then((entry) => {
      if (entry?.url) {
        try {
          const parsed = parseVolumeUrl(entry.url) as any;
          const providerId = computeVolumeUrl(parsed);
          setRemoteConfig({ providerId, path: parsed.path, enabled: entry.default === true });
          setSelectedProviderId(providerId);
          setCustomPath(parsed.path);
        } catch {
          setCustomPath(defaultPath);
        }
      } else {
        setCustomPath(defaultPath);
      }
    });
  }, [projectId, defaultPath, useVaultStore]);

  const store = useVaultStore;

  const { isExporting, handleExport } = useExportVault(useVaultStore, projectId);

  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isRebuildingLedger, setIsRebuildingLedger] = useState(false);

  const handleRebuildIndex = async () => {
    if (!projectId) return;
    setIsRebuilding(true);
    try {
      await store.getState().rebuildIndex(projectId);
      toast.success('Index rebuilt successfully');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleRebuildLedger = async () => {
    if (!projectId) return;
    setIsRebuildingLedger(true);
    try {
      await store.getState().rebuildLedger(projectId);
      toast.success('Sync ledger rebuilt successfully');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setIsRebuildingLedger(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !selectedProviderId) return;
    try {
      await store
        .getState()
        .configureRemote(projectId, selectedProviderId, customPath || undefined);
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

  const handleToggle = async () => {
    if (!projectId || !remoteConfig) return;
    try {
      await store.getState().toggleRemote(projectId);
      setRemoteConfig({ ...remoteConfig, enabled: !remoteConfig.enabled });
      toast.success(remoteConfig.enabled ? 'Remote disabled' : 'Remote enabled');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const handleDisconnect = async () => {
    if (!projectId) return;
    try {
      await store.getState().removeRemote(projectId);
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
      <PageHeader
        title="Settings"
        leftActions={
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/s/${notebookToken}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
        }
      />

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
              if (!customPath || customPath === getDefaultRemotePath(notebookToken)) {
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
            <CardContent>
              <Button variant="outline" onClick={handleExport} disabled={isExporting || !projectId}>
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Index</CardTitle>
              <CardDescription>
                Rebuild the search index from the original note files. Use this if search results
                appear incorrect or out of date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleRebuildIndex}
                disabled={isRebuilding || !projectId}
              >
                <Database className="w-4 h-4" />
                {isRebuilding ? 'Rebuilding...' : 'Rebuild Index'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Ledger</CardTitle>
              <CardDescription>
                Rebuild the sync ledger from the local file system. Use this if sync is not
                detecting changes or manifest is missing on remote.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleRebuildLedger}
                disabled={isRebuildingLedger || !projectId}
              >
                <RefreshCw className="w-4 h-4" />
                {isRebuildingLedger ? 'Rebuilding...' : 'Rebuild Sync Ledger'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
