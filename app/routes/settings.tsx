import { AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useLocalStorage } from '~/hooks/use-local-storage';
import { STORAGE_KEYS } from '~/lib/constants';
import { WebDAVService } from '~/lib/services/webdav-service';

export default function SettingsPage() {
  const [url, setUrl] = useLocalStorage(STORAGE_KEYS.WEBDAV_URL, 'https://dav.jianguoyun.com/dav/');
  const [username, setUsername] = useLocalStorage(STORAGE_KEYS.WEBDAV_USERNAME, '');
  const [password, setPassword] = useLocalStorage(STORAGE_KEYS.WEBDAV_PASSWORD, '');

  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    setStatus('testing');
    try {
      const exists = await WebDAVService.exists('/');
      if (exists) {
        setStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error('Could not connect to root');
      }
    } catch (e) {
      setStatus('error');
      toast.error('Connection failed');
      console.error(e);
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

        <Card>
          <CardHeader>
            <CardTitle>WebDAV Configuration</CardTitle>
            <CardDescription>
              Configure your WebDAV server for data synchronization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleTestConnection} disabled={status === 'testing'}>
                {status === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {status === 'success' && (
              <div className="p-3 bg-green-100 text-green-700 rounded flex items-center gap-2 text-sm">
                <Check className="w-4 h-4" /> Connected successfully
              </div>
            )}

            {status === 'error' && (
              <div className="p-3 bg-red-100 text-red-700 rounded flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" /> Connection failed
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
