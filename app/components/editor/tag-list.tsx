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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[150px] animate-in fade-in zoom-in duration-100">
      <div className="flex flex-col p-1">
        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 mb-1">
          Existing Tags
        </div>
        {props.items.map((item, index) => (
          <button
            className={`text-left px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              index === selectedIndex
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
            key={index}
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
