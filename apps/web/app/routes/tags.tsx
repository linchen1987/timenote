import { TagsView } from '@timenote/ui';
import type { Route } from './+types/tags';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Tags - TimeNote' }];
};

export default function TagsPage() {
  return <TagsView prefetch="intent" />;
}
