import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils'; // Keep the standard util import

export interface TreeMenuItemBase {
  id: string;
  parentId: string | null;
  order: number;
}

export interface TreeMenuProps<T extends TreeMenuItemBase> {
  items: T[];
  onReorder: (updates: { id: string; order: number; parentId: string | null }[]) => Promise<void>;
  renderItemContent: (item: T, isSelected: boolean) => React.ReactNode;
  renderItemActions?: (item: T, isSelected: boolean) => React.ReactNode;
  renderDragOverlay?: (item: T) => React.ReactNode;
  selectedItemId?: string;
  className?: string;
}

const MIN_ORDER_DIFF = 1e-10;

function checkIsDescendant<T extends TreeMenuItemBase>(
  parentId: string,
  childId: string,
  allItems: T[],
): boolean {
  if (parentId === childId) return true;
  const children = allItems.filter((i) => i.parentId === parentId);
  for (const child of children) {
    if (checkIsDescendant(child.id, childId, allItems)) return true;
  }
  return false;
}

function flattenTree<T extends TreeMenuItemBase>(
  items: T[],
  expandedIds: Set<string>,
): (T & { level: number; hasChildren: boolean })[] {
  const itemIds = new Set(items.map((i) => i.id));

  // Roots are items with no parent OR parent not in the list (orphans)
  const rootItems = items
    .filter((i) => !i.parentId || !itemIds.has(i.parentId))
    .sort((a, b) => a.order - b.order);

  const result: (T & { level: number; hasChildren: boolean })[] = [];

  function traverse(item: T, level: number) {
    const children = items.filter((i) => i.parentId === item.id).sort((a, b) => a.order - b.order);

    result.push({ ...item, level, hasChildren: children.length > 0 });

    if (expandedIds.has(item.id)) {
      for (const child of children) {
        traverse(child, level + 1);
      }
    }
  }

  for (const root of rootItems) {
    traverse(root, 0);
  }

  return result;
}

function calculateNewOrder<T extends TreeMenuItemBase>(
  targetItem: T,
  dropZone: 'before' | 'after' | 'inside',
  allItems: T[],
): { order: number; parentId: string | null; needsRebalance: boolean } {
  let targetParentId: string | null;
  let siblings: T[];

  if (dropZone === 'inside') {
    targetParentId = targetItem.id;
    siblings = allItems
      .filter((i) => i.parentId === targetParentId)
      .sort((a, b) => a.order - b.order);

    if (siblings.length === 0) {
      return { order: 100, parentId: targetParentId, needsRebalance: false };
    }
    return {
      order: siblings[0].order / 2,
      parentId: targetParentId,
      needsRebalance: siblings[0].order < MIN_ORDER_DIFF,
    };
  }

  targetParentId = targetItem.parentId;
  siblings = allItems
    .filter((i) => i.parentId === targetParentId)
    .sort((a, b) => a.order - b.order);

  const targetIndex = siblings.findIndex((s) => s.id === targetItem.id);

  if (targetIndex === -1) {
    return { order: 100, parentId: targetParentId, needsRebalance: false };
  }

  if (dropZone === 'before') {
    if (targetIndex === 0) {
      const newOrder = siblings[0].order / 2;
      return {
        order: newOrder,
        parentId: targetParentId,
        needsRebalance: newOrder < MIN_ORDER_DIFF,
      };
    }
    const prev = siblings[targetIndex - 1];
    const curr = siblings[targetIndex];
    const newOrder = (prev.order + curr.order) / 2;
    return {
      order: newOrder,
      parentId: targetParentId,
      needsRebalance: newOrder - prev.order < MIN_ORDER_DIFF,
    };
  } else {
    if (targetIndex === siblings.length - 1) {
      return {
        order: siblings[targetIndex].order + 100,
        parentId: targetParentId,
        needsRebalance: false,
      };
    }
    const curr = siblings[targetIndex];
    const next = siblings[targetIndex + 1];
    const newOrder = (curr.order + next.order) / 2;
    return {
      order: newOrder,
      parentId: targetParentId,
      needsRebalance: next.order - newOrder < MIN_ORDER_DIFF,
    };
  }
}

export function TreeMenu<T extends TreeMenuItemBase>({
  items: externalItems,
  onReorder,
  renderItemContent,
  renderItemActions,
  renderDragOverlay,
  selectedItemId,
  className,
}: TreeMenuProps<T>) {
  const [items, setItems] = useState<T[]>(externalItems);
  const itemsRef = useRef<T[]>(externalItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{
    id: string;
    type: 'before' | 'after' | 'inside';
  } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Sync with external items when not dragging
  useEffect(() => {
    if (!activeId && !isRepositioning) {
      setItems(externalItems);
      itemsRef.current = externalItems;
    }
  }, [externalItems, activeId, isRepositioning]);

  // Auto-expand parents on first load
  useEffect(() => {
    if (items.length > 0) {
      setExpandedIds((prev) => {
        if (prev.size > 0) return prev;
        const allFolderIds = items
          .filter((i) => items.some((child) => child.parentId === i.id))
          .map((i) => i.id);
        return new Set(allFolderIds);
      });
    }
  }, [items]);

  const visibleItems = useMemo(() => {
    return flattenTree(items, expandedIds);
  }, [items, expandedIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropIndicator(null);
    pointerRef.current = null;
    const element = document.querySelector(`[data-id="${event.active.id}"]`);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width * 0.9);
    }
  };

  const getDropAction = (activeId: string, overId: string, pointerY: number) => {
    if (activeId === overId) return { type: null, isValid: false };

    const overElement = document.querySelector(`[data-id="${overId}"]`);
    if (!overElement) return { type: null, isValid: false };

    const rect = overElement.getBoundingClientRect();
    const relativeY = pointerY - rect.top;
    const ratio = relativeY / rect.height;

    let type: 'before' | 'after' | 'inside' = 'inside';
    if (ratio < 0.4) type = 'before';
    else if (ratio > 0.6) type = 'after';

    const activeItem = itemsRef.current.find((i) => i.id === activeId);
    const overItem = itemsRef.current.find((i) => i.id === overId);

    if (!activeItem || !overItem) return { type, isValid: false };

    if (checkIsDescendant(activeItem.id, overItem.id, itemsRef.current)) {
      return { type, isValid: false };
    }

    if (type === 'inside') {
      if (activeItem.parentId === overItem.id) {
        const children = itemsRef.current
          .filter((i) => i.parentId === overItem.id)
          .sort((a, b) => a.order - b.order);
        if (children[0]?.id === activeItem.id) {
          return { type, isValid: false };
        }
      }
    } else {
      if (activeItem.parentId === overItem.parentId) {
        const siblings = itemsRef.current
          .filter((i) => i.parentId === overItem.parentId)
          .sort((a, b) => a.order - b.order);
        const activeIndex = siblings.findIndex((i) => i.id === activeItem.id);
        const overIndex = siblings.findIndex((i) => i.id === overItem.id);
        if (type === 'before' && activeIndex === overIndex - 1) {
          return { type, isValid: false };
        }
        if (type === 'after' && activeIndex === overIndex + 1) {
          return { type, isValid: false };
        }
      }
    }

    return { type, isValid: true };
  };

  const handleDragMove = (event: DragMoveEvent) => {
    pointerRef.current = { x: event.delta.x, y: event.delta.y };

    const { active, over } = event;
    if (!over) {
      setDropIndicator(null);
      return;
    }

    const overElement = document.querySelector(`[data-id="${over.id}"]`);
    if (!overElement) {
      setDropIndicator(null);
      return;
    }

    const rect = overElement.getBoundingClientRect();
    const pointerY = event.activatorEvent
      ? (event.activatorEvent as PointerEvent).clientY + event.delta.y
      : rect.top + rect.height / 2;

    const { type, isValid } = getDropAction(String(active.id), String(over.id), pointerY);

    if (isValid && type) {
      setDropIndicator((prev) => {
        if (prev?.id === String(over.id) && prev?.type === type) return prev;
        return { id: String(over.id), type };
      });
    } else {
      setDropIndicator(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setDropIndicator(null);
    }
  };

  const rebalanceSiblings = async (parentId: string | null) => {
    const siblings = itemsRef.current
      .filter((i) => i.parentId === parentId)
      .sort((a, b) => a.order - b.order);

    const updates = siblings.map((item, index) => ({
      id: item.id,
      order: index * 100,
      parentId,
    }));

    await onReorder(updates);
    return updates;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveWidth(null);
    setDropIndicator(null);
    pointerRef.current = null;

    if (!over || active.id === over.id) return;

    const overElement = document.querySelector(`[data-id="${over.id}"]`);
    let pointerY = 0;
    if (overElement) {
      const rect = overElement.getBoundingClientRect();
      pointerY = event.activatorEvent
        ? (event.activatorEvent as PointerEvent).clientY + event.delta.y
        : rect.top + rect.height / 2;
    }

    const { type, isValid } = getDropAction(String(active.id), String(over.id), pointerY);

    if (!isValid || !type) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);

    if (!activeItem || !overItem) return;

    setIsRepositioning(true);

    const {
      order: newOrder,
      parentId: newParentId,
      needsRebalance,
    } = calculateNewOrder(overItem, type, itemsRef.current);

    const allUpdates: { id: string; order: number; parentId: string | null }[] = [
      { id: activeItem.id, order: newOrder, parentId: newParentId },
    ];

    const newItems = items.map((item) => {
      if (item.id === activeItem.id) {
        return { ...item, order: newOrder, parentId: newParentId };
      }
      return item;
    });

    itemsRef.current = newItems;
    setItems(newItems);

    try {
      if (needsRebalance) {
        await rebalanceSiblings(newParentId);
        // The external items sync will fix up the local state
      } else {
        await onReorder(allUpdates);
      }
      // Add slight delay to allow DB sync to trigger onLiveQuery
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Reorder failed:', error);
      // Revert to external source of truth if failed
      setItems(externalItems);
      itemsRef.current = externalItems;
    } finally {
      setIsRepositioning(false);
    }
  };

  const handleToggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeItem = useMemo(
    () => (activeId ? items.find((i) => i.id === activeId) : null),
    [activeId, items],
  );

  return (
    <div className={cn('space-y-1 w-full max-w-full overflow-hidden', className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveWidth(null);
          setDropIndicator(null);
          pointerRef.current = null;
        }}
      >
        {visibleItems.map((node) => (
          <TreeMenuItemNode
            key={node.id}
            node={node}
            isSelected={selectedItemId === node.id}
            isExpanded={expandedIds.has(node.id)}
            onToggleExpand={handleToggleExpand}
            dropIndicator={dropIndicator?.id === node.id ? dropIndicator.type : null}
            renderItemContent={renderItemContent}
            renderItemActions={renderItemActions}
          />
        ))}
        <DragOverlay dropAnimation={null}>
          {activeItem && renderDragOverlay ? (
            <div
              className="py-1.5 px-2 bg-sidebar-accent text-sidebar-accent-foreground rounded-md shadow-xl border border-primary/20 scale-[1.02] flex items-center gap-2 pointer-events-none opacity-60"
              style={{ width: activeWidth ?? undefined }}
            >
              {renderDragOverlay(activeItem)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function TreeMenuItemNode<T extends TreeMenuItemBase>({
  node,
  isSelected,
  isExpanded,
  onToggleExpand,
  dropIndicator,
  renderItemContent,
  renderItemActions,
}: {
  node: T & { level: number; hasChildren: boolean };
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string, e?: React.MouseEvent) => void;
  dropIndicator: 'before' | 'after' | 'inside' | null;
  renderItemContent: (item: T, isSelected: boolean) => React.ReactNode;
  renderItemActions?: (item: T, isSelected: boolean) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    isDragging,
  } = useDraggable({
    id: node.id,
    data: node,
  });

  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: node.id,
    data: node,
  });

  const setNodeRef = (element: HTMLElement | null) => {
    setDraggableNodeRef(element);
    setDroppableNodeRef(element);
  };

  const indicatorMarginLeft = `${node.level * 0.5 + 1.5}rem`;

  return (
    <div
      ref={setNodeRef}
      data-id={node.id}
      style={{
        opacity: isDragging ? 0.3 : 1,
        paddingLeft: `${node.level * 0.5 + 0.5}rem`,
      }}
      className={cn(
        'group relative flex items-center gap-2 py-1.5 px-2 rounded-md transition-all text-sm font-medium w-full max-w-full overflow-hidden',
        isSelected
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
        isDragging && 'border border-dashed border-primary opacity-50',
        dropIndicator === 'inside' && 'ring-2 ring-dashed ring-primary/60 bg-primary/5',
      )}
    >
      {dropIndicator === 'before' && (
        <div
          className="absolute -top-0.5 h-1 bg-primary z-20 rounded-full"
          style={{ left: indicatorMarginLeft, right: '0.5rem' }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
      {dropIndicator === 'after' && (
        <div
          className="absolute -bottom-0.5 h-1 bg-primary z-20 rounded-full"
          style={{ left: indicatorMarginLeft, right: '0.5rem' }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
        </div>
      )}

      {node.hasChildren ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 hover:bg-transparent flex-shrink-0"
          onClick={(e) => onToggleExpand(node.id, e)}
        >
          <ChevronRight className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')} />
        </Button>
      ) : (
        <div className="w-4 flex-shrink-0" />
      )}

      <div className="flex-1 flex items-center min-w-0 overflow-hidden text-left cursor-pointer">
        {renderItemContent(node, isSelected)}
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 ml-1">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="p-1 cursor-grab active:cursor-grabbing hover:bg-sidebar-accent rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
            aria-label="Drag handle"
          >
            <title>Drag handle</title>
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </button>
        {renderItemActions?.(node, isSelected)}
      </div>
    </div>
  );
}
