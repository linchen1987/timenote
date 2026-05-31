'use client';

import { SettingsPage } from '@timenote/ui';
import { testProviderConnection } from '~/lib/fs-service';
import { useVaultStore } from '~/lib/vault-store';
import type { Route } from './+types/settings';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Settings - TimeNote' }];
};

export default function SettingsRoute() {
  return (
    <SettingsPage useVaultStore={useVaultStore} testProviderConnection={testProviderConnection} />
  );
}
