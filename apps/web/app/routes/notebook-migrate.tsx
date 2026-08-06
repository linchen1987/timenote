'use client';

import { VaultNoteMigrationPage } from '@timenote/ui';
import { useVaultStore } from '~/lib/vault-store';
import type { Route } from './+types/notebook-migrate';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Move Notes - TimeNote' }];
};

export default function NotebookMigrateRoute() {
  return <VaultNoteMigrationPage useStore={useVaultStore} />;
}
