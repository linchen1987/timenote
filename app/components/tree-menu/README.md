# TreeMenu Component

A draggable hierarchical tree menu component with drag-and-drop reordering support.

## Data Structure

Items must extend `TreeMenuItemBase`:

```typescript
interface TreeMenuItemBase {
  id: string;
  parentId: string | null;
  order: number;
}
```

- `id` - Unique identifier
- `parentId` - Parent item's id, `null` for root items
- `order` - Sort order among siblings (uses fractional indexing for smooth reordering)

## Features

- Hierarchical tree display with expand/collapse
- Drag and drop reordering
- Three drop zones: before, after, inside (nested)
- Visual drop indicators
- Automatic order rebalancing when values become too small
- Selection state support
- Customizable content and action rendering

## Usage

```tsx
import { TreeMenu, TreeMenuItemBase } from '~/components/tree-menu';

interface MenuItem extends TreeMenuItemBase {
  name: string;
  type: 'note' | 'search';
  target: string;
}

function MyComponent() {
  const handleReorder = async (updates: { id: string; order: number; parentId: string | null }[]) => {
    // Save to database
  };

  return (
    <TreeMenu<MenuItem>
      items={menuItems}
      onReorder={handleReorder}
      selectedItemId={selectedId}
      renderItemContent={(item, isSelected) => (
        <span>{item.name}</span>
      )}
      renderItemActions={(item, isSelected) => (
        <button onClick={() => handleDelete(item.id)}>Delete</button>
      )}
      renderDragOverlay={(item) => (
        <span>{item.name}</span>
      )}
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `items` | `T[]` | Yes | - | Array of tree items |
| `onReorder` | `(updates) => Promise<void>` | Yes | - | Callback when items are reordered |
| `renderItemContent` | `(item, isSelected) => ReactNode` | Yes | - | Render item main content |
| `renderItemActions` | `(item, isSelected) => ReactNode` | No | - | Render item action buttons (shown on hover) |
| `renderDragOverlay` | `(item) => ReactNode` | No | - | Custom drag preview |
| `selectedItemId` | `string` | No | - | Currently selected item id |
| `className` | `string` | No | - | Additional CSS classes |
| `defaultExpandedDepth` | `number` | No | `0` | Depth level to expand by default (0 = all collapsed, 1 = root expanded, etc.) |
| `initialExpandedIds` | `string[]` | No | - | Initial expanded item ids (overrides `defaultExpandedDepth`) |

