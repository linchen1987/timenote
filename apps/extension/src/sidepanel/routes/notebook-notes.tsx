import { NotebookTimeline } from '@timenote/ui';
import { useSyncStore } from '../../lib/sync-store';

export function NotebookTimelinePage() {
  return <NotebookTimeline useSyncStore={useSyncStore} searchMaxWidth="280px" />;
}
