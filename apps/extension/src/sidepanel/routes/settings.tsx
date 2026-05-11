import { SettingsPage as SharedSettingsPage } from '@timenote/ui';
import { testProviderConnection } from '../../lib/fs-service';

export function SettingsPage() {
  return <SharedSettingsPage testProviderConnection={testProviderConnection} />;
}
