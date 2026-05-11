import { deleteProvider, listProviders, type ProviderConfig, saveProvider } from '@timenote/core';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { emptyProviderForm, ProviderForm, type ProviderFormState } from '../provider-form';
import { ProviderListCard } from '../provider-list-card';
import { Button } from '../ui/button';

export interface SettingsPageProps {
  testProviderConnection: (provider: ProviderConfig) => Promise<boolean>;
}

export function SettingsPage({ testProviderConnection }: SettingsPageProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>(() => listProviders());
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<ProviderFormState>({ ...emptyProviderForm });
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

  const refreshList = () => setProviders(listProviders());

  const handleSave = () => {
    try {
      if (form.type === 'webdav') {
        if (!form.webdav.url || !form.webdav.username) {
          toast.error('URL and Username are required');
          return;
        }
        saveProvider({ type: 'webdav', webdav: form.webdav });
      } else {
        if (!form.s3.bucket || !form.s3.accessKeyId) {
          toast.error('Bucket and Access Key ID are required');
          return;
        }
        saveProvider({
          type: 's3',
          s3: {
            ...form.s3,
            endpoint: form.s3.endpoint || undefined,
            region: form.s3.region || undefined,
          },
        });
      }
      refreshList();
      setIsAdding(false);
      setForm({ ...emptyProviderForm });
      setConnectionStatus('idle');
      toast.success('Provider saved');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const handleDelete = (id: string) => {
    deleteProvider(id);
    refreshList();
    toast.success('Provider deleted');
  };

  const handleTest = async () => {
    setConnectionStatus('testing');
    try {
      const config: Omit<ProviderConfig, 'id'> =
        form.type === 'webdav'
          ? { type: 'webdav', webdav: form.webdav }
          : {
              type: 's3',
              s3: {
                ...form.s3,
                endpoint: form.s3.endpoint || undefined,
                region: form.s3.region || undefined,
              },
            };
      const ok = await testProviderConnection(config as ProviderConfig);
      if (ok) {
        setConnectionStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error('Could not connect');
      }
    } catch {
      setConnectionStatus('error');
      toast.error('Connection failed');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </header>

        <ProviderListCard
          providers={providers}
          onAdd={() => {
            setIsAdding(true);
            setForm({ ...emptyProviderForm });
            setConnectionStatus('idle');
          }}
          onDelete={handleDelete}
        />

        {isAdding && (
          <ProviderForm
            form={form}
            onFormChange={setForm}
            onSave={handleSave}
            onCancel={() => {
              setIsAdding(false);
              setConnectionStatus('idle');
            }}
            onTest={handleTest}
            connectionStatus={connectionStatus}
          />
        )}
      </div>
    </div>
  );
}
