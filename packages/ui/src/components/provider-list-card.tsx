import type { FsVolumeCredential } from '@timenote/core';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };

export interface ProviderListCardProps {
  providers: VolumeCredentialEntry[];
  onAdd: () => void;
  onEdit: (volumeUrl: string) => void;
  onDelete: (volumeUrl: string) => void;
}

export function ProviderListCard({ providers, onAdd, onEdit, onDelete }: ProviderListCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Storage Providers</CardTitle>
            <CardDescription>Manage WebDAV and S3 storage connections.</CardDescription>
          </div>
          <Button onClick={onAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.volumeUrl}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm truncate">{p.volumeUrl}</p>
              <p className="text-xs text-muted-foreground">{p.scheme?.toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit(p.volumeUrl)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(p.volumeUrl)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {providers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No providers configured. Add one to enable cloud sync.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
