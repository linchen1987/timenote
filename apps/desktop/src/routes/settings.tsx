import { SettingsPage as SharedSettingsPage } from '@timenote/ui';
import { testProviderConnection } from '../lib/fs-service';
import { useVaultStore } from '../lib/vault-store';

export function SettingsPage() {
  return (
    <SharedSettingsPage
      useVaultStore={useVaultStore}
      testProviderConnection={testProviderConnection}
    />
  );
}
