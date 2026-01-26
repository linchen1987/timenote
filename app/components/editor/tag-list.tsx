import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface TagListProps {
  items: string[];
  command: (props: { id: string }) => void;
}

export const TagList = forwardRef((props: TagListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), []);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (!props.items || props.items.length === 0) {
    return null;
  }

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl overflow-hidden min-w-[150px] animate-in fade-in zoom-in duration-100">
      <div className="flex flex-col p-1">
        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
          Existing Tags
        </div>
        {props.items.map((item, index) => (
          <button
            type="button"
            className={`text-left px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              index === selectedIndex
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground text-foreground'
            }`}
            key={item}
            onClick={() => selectItem(index)}
          >
            #{item}
          </button>
        ))}
      </div>
    </div>
  );
});

TagList.displayName = 'TagList';
