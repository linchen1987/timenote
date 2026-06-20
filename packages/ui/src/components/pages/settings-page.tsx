import type { FsClientConfig, FsVolumeCredential } from '@timenote/core';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { NotebooksShell } from '../notebooks-shell';
import { PageHeader } from '../page-header';
import {
  emptyProviderForm,
  ProviderForm,
  type ProviderFormState,
  providerFormFromEntry,
} from '../provider-form';
import { ProviderListCard } from '../provider-list-card';
import { Button } from '../ui/button';
import type { UseVaultStoreHook } from './use-notebooks-page';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };

export interface SettingsPageProps {
  useVaultStore: UseVaultStoreHook;
  testProviderConnection: (provider: FsClientConfig) => Promise<boolean>;
}

export function SettingsPage({ useVaultStore, testProviderConnection }: SettingsPageProps) {
  const [providers, setProviders] = useState<VolumeCredentialEntry[]>(() =>
    useVaultStore.getState().listVolumeCredentials(),
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormState>({ ...emptyProviderForm });
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

  const isEditing = editingUrl !== null;
  const refreshList = () => setProviders(useVaultStore.getState().listVolumeCredentials());

  const handleSave = () => {
    try {
      if (form.scheme === 'webdav') {
        if (!form.webdav.url || !form.webdav.username) {
          toast.error('URL and Username are required');
          return;
        }
        useVaultStore.getState().saveVolumeCredential({
          scheme: 'webdav',
          host: form.webdav.url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
          username: form.webdav.username,
          password: form.webdav.password,
          tls: form.webdav.url.startsWith('https'),
        } as FsVolumeCredential);
      } else {
        if (!form.s3.bucket || !form.s3.accessKeyId) {
          toast.error('Bucket and Access Key ID are required');
          return;
        }
        useVaultStore.getState().saveVolumeCredential({
          scheme: 's3',
          endpoint: form.s3.endpoint || '',
          region: form.s3.region || undefined,
          bucket: form.s3.bucket,
          accessKeyId: form.s3.accessKeyId,
          secretAccessKey: form.s3.secretAccessKey,
        } as FsVolumeCredential);
      }
      refreshList();
      setIsAdding(false);
      setEditingUrl(null);
      setForm({ ...emptyProviderForm });
      setConnectionStatus('idle');
      toast.success(isEditing ? 'Provider updated' : 'Provider saved');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const handleEdit = (volumeUrl: string) => {
    const entry = useVaultStore
      .getState()
      .listVolumeCredentials()
      .find((p) => p.volumeUrl === volumeUrl);
    if (!entry) return;
    setIsAdding(false);
    setEditingUrl(volumeUrl);
    setForm(providerFormFromEntry(entry));
    setConnectionStatus('idle');
  };

  const handleDelete = (volumeUrl: string) => {
    useVaultStore.getState().deleteVolumeCredential(volumeUrl);
    if (editingUrl === volumeUrl) {
      setEditingUrl(null);
      setForm({ ...emptyProviderForm });
      setConnectionStatus('idle');
    }
    refreshList();
    toast.success('Provider deleted');
  };

  const handleTest = async () => {
    setConnectionStatus('testing');
    try {
      const config: FsClientConfig =
        form.scheme === 'webdav'
          ? {
              scheme: 'webdav',
              host: form.webdav.url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
              username: form.webdav.username,
              password: form.webdav.password,
              tls: form.webdav.url.startsWith('https'),
              rootPath: '/',
            }
          : {
              scheme: 's3',
              endpoint: form.s3.endpoint || '',
              region: form.s3.region || undefined,
              bucket: form.s3.bucket,
              accessKeyId: form.s3.accessKeyId,
              secretAccessKey: form.s3.secretAccessKey,
              rootPath: '/',
            };
      const ok = await testProviderConnection(config);
      if (ok) {
        setConnectionStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error('Could not connect');
      }
    } catch (e) {
      setConnectionStatus('error');
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error';
      toast.error(`Connection failed: ${msg}`);
    }
  };

  return (
    <NotebooksShell useVaultStore={useVaultStore} activeFooter="settings">
      <PageHeader
        title="Settings"
        leftActions={
          <Button variant="ghost" size="icon" asChild>
            <Link to="/s/list">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
        }
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <ProviderListCard
          providers={providers}
          onAdd={() => {
            setEditingUrl(null);
            setIsAdding(true);
            setForm({ ...emptyProviderForm });
            setConnectionStatus('idle');
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {(isAdding || isEditing) && (
          <ProviderForm
            form={form}
            onFormChange={setForm}
            onSave={handleSave}
            onCancel={() => {
              setIsAdding(false);
              setEditingUrl(null);
              setConnectionStatus('idle');
            }}
            onTest={handleTest}
            connectionStatus={connectionStatus}
            isEdit={isEditing}
          />
        )}
      </div>
    </NotebooksShell>
  );
}
