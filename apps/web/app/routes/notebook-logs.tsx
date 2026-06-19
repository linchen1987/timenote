'use client';

import { NotebookLogsPage } from '@timenote/ui';
import { useParams } from 'react-router';
import { useVaultStore } from '~/lib/vault-store';
import type { Route } from './+types/notebook-logs';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Diagnostics Logs - TimeNote' }];
};

export default function NotebookLogsRoute() {
  const { notebookToken } = useParams();
  return <NotebookLogsPage useVaultStore={useVaultStore} notebookToken={notebookToken!} />;
}
