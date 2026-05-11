'use client';

import { NotebooksPage } from '@timenote/ui';
import type { MetaFunction } from 'react-router';
import { useVaultStore } from '~/lib/vault-store';

export const meta: MetaFunction = () => {
  return [{ title: '笔记本 - Time Note' }];
};

export default function NotebooksRoute() {
  return <NotebooksPage useVaultStore={useVaultStore} logoSrc="/logo.svg" />;
}
