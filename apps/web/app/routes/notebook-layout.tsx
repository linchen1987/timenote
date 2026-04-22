'use client';

import { NotebookLayout } from '@timenote/ui';
import { useCallback } from 'react';
import { usePWA } from '~/hooks/use-pwa';
import type { Route } from './+types/notebook-layout';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'TimeNote' }];
};

export default function NotebookLayoutPage() {
  const isPWA = usePWA();

  const manifestEffect = useCallback((notebookToken: string) => {
    let link = document.querySelector(`link[rel="manifest"]`) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = `/s/${notebookToken}/manifest.webmanifest`;

    return () => {
      link?.remove();
    };
  }, []);

  return <NotebookLayout isPWA={isPWA} extraEffects={manifestEffect} />;
}
