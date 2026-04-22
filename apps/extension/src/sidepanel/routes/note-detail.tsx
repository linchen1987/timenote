import { NoteDetailView } from '@timenote/ui';
import { useSyncStore } from '../../lib/sync-store';

export function NoteDetail() {
  return <NoteDetailView useSyncStore={useSyncStore} />;
}
