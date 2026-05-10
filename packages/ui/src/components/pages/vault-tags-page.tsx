import { parseNotebookId, type VaultStore } from '@timenote/core';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { TagWithCount } from '../tags-view';
import { TagsView } from '../tags-view';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface VaultTagsPageProps {
  useStore: UseVaultStoreHook;
  prefetch?: 'intent' | 'render' | 'none' | 'hover';
}

export function VaultTagsPage({ useStore, prefetch }: VaultTagsPageProps) {
  const { notebookToken } = useParams();
  const projectId = parseNotebookId(notebookToken || '');

  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const init = async () => {
      try {
        await useStore.getState().init();
        await useStore.getState().activateVault(projectId);
        if (cancelled) return;
        const result = await useStore.getState().getTagsWithCounts();
        if (cancelled) return;
        setTags(result);
        setReady(true);
      } catch (e) {
        console.error('Failed to activate vault:', e);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId, useStore.getState]);

  return <TagsView tags={tags} loading={!ready} {...(prefetch ? { prefetch } : {})} />;
}
