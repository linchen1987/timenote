'use client';

import { SettingsPage } from '@timenote/ui';
import { testProviderConnection } from '~/lib/fs-service';
import type { Route } from './+types/settings';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Settings - TimeNote' }];
};

export default function SettingsRoute() {
  return <SettingsPage testProviderConnection={testProviderConnection} />;
}
