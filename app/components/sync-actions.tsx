import { Save } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface SyncActionsProps {
  isSyncing: boolean;
  showSaveButton?: boolean;
  onSave?: () => void;
  size?: 'default' | 'small';
  className?: string;
}

export function SyncActions({
  isSyncing,
  showSaveButton = true,
  onSave,
  size = 'default',
  className,
}: SyncActionsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isSyncing && <span className="text-xs text-muted-foreground font-medium">Syncing...</span>}
      {showSaveButton && !isSyncing && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          title="Save to local (⌘+S)"
          className={size === 'default' ? 'rounded-full' : 'shrink-0 mr-2'}
        >
          <Save className={size === 'default' ? 'w-5 h-5 text-primary' : 'w-4 h-4 text-primary'} />
        </Button>
      )}
    </div>
  );
}
