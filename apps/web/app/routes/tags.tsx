'use client';

import { parseNotebookId } from '@timenote/core';
import type { TagWithCount } from '@timenote/ui';
import { TagsView } from '@timenote/ui';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useVaultStore } from '~/lib/vault-store';

export default function TagsPage() {
  const { notebookToken } = useParams();
  const projectId = parseNotebookId(notebookToken || '');

  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const init = async () => {
      try {
        await useVaultStore.getState().init();
        await useVaultStore.getState().activateVault(projectId);
        if (cancelled) return;
        const result = await useVaultStore.getState().getTagsWithCounts();
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
  }, [projectId]);

  return <TagsView tags={tags} loading={!ready} prefetch="intent" />;
}
