'use client';

import { NotebookTimeline } from '@timenote/ui';
import { useSyncStore } from '~/lib/sync-store';

export default function NotebookTimelinePage() {
  return <NotebookTimeline useSyncStore={useSyncStore} prefetch="intent" searchMaxWidth="320px" />;
}
