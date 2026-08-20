import { type AppPlatform, detectPlatform, getBuildTime, getBuildTimeDate } from '@timenote/core';
import { Check, Copy, Globe, Monitor, Puzzle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const PLATFORM_META: Record<AppPlatform, { label: string; icon: typeof Globe }> = {
  web: { label: 'Web', icon: Globe },
  extension: { label: 'Extension', icon: Puzzle },
  desktop: { label: 'Desktop', icon: Monitor },
};

function formatBuildTime(date: Date | null): string {
  if (!date) return getBuildTime();
  return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}

export interface AboutCardStatItem {
  key: string;
  label: string;
  value: number | string | null;
}

export interface AboutCardProps {
  stats?: AboutCardStatItem[];
}

export function AboutCard({ stats }: AboutCardProps = {}) {
  const [copied, setCopied] = useState(false);
  const platform = detectPlatform();
  const buildDate = getBuildTimeDate();
  const PlatformIcon = PLATFORM_META[platform].icon;

  const handleCopy = async () => {
    const value = getBuildTimeDate()?.toISOString() ?? getBuildTime();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Build time copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy build time');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {stats?.map(({ key, label, value }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium tabular-nums">{value ?? '—'}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Platform</span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <PlatformIcon className="h-4 w-4 text-muted-foreground" />
              {PLATFORM_META[platform].label}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Build</span>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy build time"
              className="group flex items-center gap-1.5 text-right font-mono text-sm tabular-nums text-muted-foreground transition-colors hover:text-foreground"
            >
              {formatBuildTime(buildDate)}
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
