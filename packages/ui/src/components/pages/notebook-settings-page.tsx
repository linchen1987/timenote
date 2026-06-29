import {
  computeVolumeUrl,
  type FsVolumeCredential,
  getDefaultRemotePath,
  parseNotebookId,
  parseVolumeUrl,
} from '@timenote/core';
import {
  Database,
  Download,
  FileText,
  FolderTree,
  HardDrive,
  RefreshCw,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '../page-header';
import { RemoteSyncSection } from '../remote-sync-section';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { useExportVault } from './use-export-vault';
import type { UseVaultStoreHook } from './use-notebooks-page';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };

const DISPLAY_SCHEME_ALIASES: Record<string, string> = { localfs: 'fs' };

function toDisplayUrl(url: string): string {
  const scheme = /^([a-z]+):\/\//.exec(url)?.[1];
  const alias = scheme ? DISPLAY_SCHEME_ALIASES[scheme] : undefined;
  if (scheme && alias) {
    return `${alias}:${url.slice(scheme.length + 1)}`;
  }
  return url;
}

export interface NotebookSettingsPageProps {
  useVaultStore: UseVaultStoreHook;
  notebookToken: string;
}

export function NotebookSettingsPage({ useVaultStore, notebookToken }: NotebookSettingsPageProps) {
  const projectId = notebookToken ? parseNotebookId(notebookToken) : null;

  const [providers, setProviders] = useState<VolumeCredentialEntry[]>([]);
  const [remoteConfig, setRemoteConfig] = useState<{
    providerId: string;
    path: string;
    enabled: boolean;
  } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [customPath, setCustomPath] = useState('');

  const defaultPath = projectId ? getDefaultRemotePath(projectId) : '';

  useEffect(() => {
    setProviders(useVaultStore.getState().listVolumeCredentials());
  }, [useVaultStore]);

  useEffect(() => {
    if (!projectId) return;
    const store = useVaultStore.getState();
    store.getRemoteConfig(projectId).then((entry) => {
      if (entry?.url) {
        try {
          const parsed = parseVolumeUrl(entry.url) as any;
          const providerId = computeVolumeUrl(parsed);
          const rootPath = parsed.rootPath && parsed.rootPath !== '/' ? parsed.rootPath : '';
          setRemoteConfig({ providerId, path: rootPath, enabled: entry.default === true });
          setSelectedProviderId(providerId);
          setCustomPath(rootPath);
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
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [isTogglingLog, setIsTogglingLog] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    store
      .getState()
      .getVaultSourceUrl(projectId)
      .then(setSourceUrl)
      .catch(() => {});
  }, [projectId, store]);

  useEffect(() => {
    if (!projectId) return;
    store
      .getState()
      .getLoggingEnabled(projectId)
      .then(setLoggingEnabled)
      .catch(() => {});
  }, [projectId, store]);

  const handleToggleLogging = async () => {
    if (!projectId) return;
    setIsTogglingLog(true);
    try {
      const next = !loggingEnabled;
      await store.getState().setLoggingEnabled(projectId, next);
      setLoggingEnabled(next);
      toast.success(next ? 'Logging enabled' : 'Logging disabled');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setIsTogglingLog(false);
    }
  };

  const handleClearLogs = async () => {
    if (!projectId) return;
    setIsClearingLogs(true);
    try {
      await store.getState().clearLogs(projectId);
      toast.success('Logs cleared');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setIsClearingLogs(false);
    }
  };

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

  const handleRemove = async () => {
    if (!projectId) return;
    try {
      await store.getState().removeRemote(projectId);
      setRemoteConfig(null);
      setSelectedProviderId('');
      setCustomPath(defaultPath);
      toast.success('Remote removed');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <PageHeader title="Settings" />

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <HardDrive className="w-5 h-5 text-muted-foreground" />
                Storage
              </CardTitle>
              <CardDescription>
                Local and remote storage endpoints for this notebook.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Local</span>
                </div>
                <div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2">
                  <p className="font-mono text-sm break-all">
                    {sourceUrl ? toDisplayUrl(sourceUrl) : '—'}
                  </p>
                </div>
              </div>

              <Separator className="my-6" />

              <RemoteSyncSection
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
                onRemove={handleRemove}
                onAddProvider={() => {}}
              />
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Diagnostics Logs</CardTitle>
              <CardDescription>
                Record remote requests and sync comparison results to help diagnose issues like
                unexpected full syncs. Logs are stored locally (not synced) and capped at the most
                recent 500 entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={loggingEnabled ? 'default' : 'outline'}
                  onClick={handleToggleLogging}
                  disabled={isTogglingLog || !projectId}
                >
                  <ScrollText className="w-4 h-4" />
                  {isTogglingLog ? '...' : loggingEnabled ? 'Logging On' : 'Enable Logging'}
                </Button>
                <Button variant="outline" asChild disabled={!projectId}>
                  <Link to={`/s/${notebookToken}/logs`}>
                    <FileText className="w-4 h-4" />
                    View Logs
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearLogs}
                  disabled={isClearingLogs || !projectId}
                >
                  <Trash2 className="w-4 h-4" />
                  {isClearingLogs ? 'Clearing...' : 'Clear'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
