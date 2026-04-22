'use client';

import { NoteDetailView } from '@timenote/ui';
import { useSyncStore } from '~/lib/sync-store';
import type { Route } from './+types/notebook-notedetail';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Note - TimeNote' }];
};

export default function NoteDetailPage() {
  return <NoteDetailView useSyncStore={useSyncStore} prefetch="intent" />;
}
