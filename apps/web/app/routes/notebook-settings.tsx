'use client';

import { NotebookSettingsPage } from '@timenote/ui';
import { useParams } from 'react-router';
import { useVaultStore } from '~/lib/vault-store';
import type { Route } from './+types/notebook-settings';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Settings - TimeNote' }];
};

export default function NotebookSettingsRoute() {
  const { notebookToken } = useParams();
  return <NotebookSettingsPage useVaultStore={useVaultStore} notebookToken={notebookToken!} />;
}
