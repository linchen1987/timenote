import { ArrowLeft, FileText, Folder, Globe, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useLocalStorage } from '~/hooks/use-local-storage';
import { STORAGE_KEYS } from '~/lib/constants';

export default function WebDAVPlayground() {
  const [url, setUrl] = useLocalStorage(STORAGE_KEYS.WEBDAV_URL, 'https://dav.jianguoyun.com/dav/');
  const [username, setUsername] = useLocalStorage(STORAGE_KEYS.WEBDAV_USERNAME, '');
  const [password, setPassword] = useLocalStorage(STORAGE_KEYS.WEBDAV_PASSWORD, '');

  const [currentPath, setCurrentPath] = useState('/');

  const [items, setItems] = useState<any[]>([]);
  const [fileContent, setFileContent] = useState('');
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const callApi = async (method: string, path: string, args?: any) => {
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/fs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: { type: 'webdav', url, username, password },
          method,
          path,
          args,
        }),
      });
      const data = (await res.json()) as { error?: string; result?: any };
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
      setStatus('success');
      return data.result;
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message);
      throw e;
    }
  };

  const handleList = async (path = currentPath) => {
    try {
      const result = await callApi('list', path);
      // Ensure result is array, API might wrap it or return single object if not dir
      const list = Array.isArray(result) ? result : [result];
      setItems(list);
      setCurrentPath(path);
      setViewingFile(null);
    } catch (_e) {}
  };

  const handleRead = async (item: any) => {
    try {
      const content = await callApi('read', item.filename);
      setFileContent(content);
      setViewingFile(item.filename);
    } catch (_e) {}
  };

  const handleWrite = async () => {
    if (!viewingFile) return;
    try {
      await callApi('write', viewingFile, { content: fileContent });
      setMessage('File saved!');
    } catch (_e) {}
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Delete ${path}?`)) return;
    try {
      await callApi('delete', path);
      handleList();
    } catch (_e) {}
  };

  const handleMkdir = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    try {
      const newPath = currentPath.endsWith('/')
        ? `${currentPath}${name}`
        : `${currentPath}/${name}`;
      await callApi('mkdir', newPath);
      handleList();
    } catch (_e) {}
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6 text-zinc-900 dark:text-zinc-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Link to="/playground">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WebDAV Manager</h1>
            <p className="text-muted-foreground">Server-side proxy via /api/fs</p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
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
            <div className="sm:col-span-3">
              <Button onClick={() => handleList('/')} disabled={status === 'loading'}>
                Connect & List Root
              </Button>
            </div>
          </CardContent>
        </Card>

        {status === 'error' && (
          <div className="p-4 bg-red-100 text-red-700 rounded-md border border-red-200">
            {message}
          </div>
        )}

        {status === 'success' && message && (
          <div className="p-4 bg-green-100 text-green-700 rounded-md border border-green-200">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span>Explorer</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={handleMkdir}>
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleList(currentPath)}>
                    ↺
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="truncate" title={currentPath}>
                {currentPath}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="divide-y">
                {currentPath !== '/' && (
                  <button
                    onClick={() => handleList(currentPath.split('/').slice(0, -1).join('/') || '/')}
                    className="w-full text-left p-3 hover:bg-muted flex items-center gap-2 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> ..
                  </button>
                )}
                {items.map((item) => (
                  <div
                    key={item.filename}
                    className="group flex items-center justify-between p-3 hover:bg-muted text-sm"
                  >
                    <button
                      className="flex items-center gap-2 flex-1 truncate text-left"
                      onClick={() =>
                        item.type === 'directory' ? handleList(item.filename) : handleRead(item)
                      }
                    >
                      {item.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-blue-500" />
                      ) : (
                        <FileText className="w-4 h-4 text-zinc-500" />
                      )}
                      <span className="truncate">{item.basename}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6"
                      onClick={() => handleDelete(item.filename)}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle>Editor</CardTitle>
              <CardDescription>{viewingFile || 'Select a file to view/edit'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col">
              {viewingFile ? (
                <>
                  <textarea
                    className="flex-1 resize-none border-0 focus-visible:ring-0 rounded-none p-4 font-mono text-sm w-full bg-transparent outline-none"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                  />
                  <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
                    <Button size="sm" onClick={handleWrite} disabled={status === 'loading'}>
                      <Save className="w-4 h-4 mr-2" /> Save
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  No file selected
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
