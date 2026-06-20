import { Cloud, CloudDownload, Loader2, RefreshCw, Settings } from 'lucide-react';
import { Link } from 'react-router';
import type { UseProviderScannerReturn } from './pages/use-provider-scanner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

export interface OpenCloudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanner: UseProviderScannerReturn;
}

export function OpenCloudDialog({ open, onOpenChange, scanner }: OpenCloudDialogProps) {
  const hasProviders = scanner.providers.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            从云端打开
          </DialogTitle>
          <DialogDescription>扫描已配置的远程存储，或手动拉取指定路径的笔记本。</DialogDescription>
        </DialogHeader>

        <Separator />

        {!hasProviders ? (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
              <Settings className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">尚未配置云端存储</p>
              <p className="text-sm text-muted-foreground">先在设置中添加 S3 / WebDAV 卷。</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">前往设置</Link>
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  存储卷
                </p>
                <div className="flex flex-col gap-2">
                  {scanner.providers.map((p) => (
                    <div
                      key={p.volumeUrl}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs truncate">{p.volumeUrl}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.scheme?.toUpperCase()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => scanner.handleScan(p.volumeUrl)}
                        disabled={scanner.scanningId === p.volumeUrl}
                      >
                        {scanner.scanningId === p.volumeUrl ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span className="ml-1">扫描</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => {
                    scanner.setShowManualPull(!scanner.showManualPull);
                    if (!scanner.showManualPull) {
                      scanner.setManualProviderId(scanner.providers[0]?.volumeUrl ?? '');
                    }
                  }}
                >
                  {scanner.showManualPull ? '收起手动拉取' : '手动拉取指定路径'}
                </button>

                {scanner.showManualPull && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="space-y-1.5">
                      <label htmlFor="manual-provider" className="text-xs font-medium">
                        Provider
                      </label>
                      <select
                        id="manual-provider"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={scanner.manualProviderId}
                        onChange={(e) => scanner.setManualProviderId(e.target.value)}
                      >
                        {scanner.providers.map((p) => (
                          <option key={p.volumeUrl} value={p.volumeUrl}>
                            {p.volumeUrl}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="manual-path" className="text-xs font-medium">
                        Path
                      </label>
                      <Input
                        id="manual-path"
                        value={scanner.manualPath}
                        onChange={(e) => scanner.setManualPath(e.target.value)}
                        placeholder="timenote/vaults/{project_id}"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={scanner.handleManualPull}
                      disabled={
                        !scanner.manualProviderId ||
                        !scanner.manualPath ||
                        scanner.isPulling === 'manual'
                      }
                    >
                      {scanner.isPulling === 'manual' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CloudDownload className="w-4 h-4 mr-2" />
                      )}
                      拉取
                    </Button>
                  </div>
                )}
              </div>

              {scanner.remoteOnlyVaults.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      远程笔记本
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {scanner.remoteOnlyVaults.map((v) => {
                        const pullKey = `${v.providerId}:${v.path}`;
                        return (
                          <div
                            key={v.projectId}
                            className="flex items-center gap-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5"
                          >
                            <Cloud className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{v.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate font-mono">
                                {v.projectId}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => scanner.handlePull(v.providerId, v.path)}
                              disabled={scanner.isPulling === pullKey}
                            >
                              {scanner.isPulling === pullKey ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CloudDownload className="w-4 h-4" />
                              )}
                              <span className="ml-1">拉取</span>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
