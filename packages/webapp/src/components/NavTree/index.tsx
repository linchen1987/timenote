import { useMemo } from 'react';
import { Box, BoxProps, Typography } from '@mui/material';
import {
  ArrowForwardIos as ArrowForwardIosIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import MuiMenu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useTheme } from '@mui/material/styles';
import { createContainer } from 'unstated-next';
import { useEffect, useRef, useState } from 'react';
import { useLocalStorageState, useDrag, useDrop } from 'ahooks';
import { MenuTreeNode } from './models';

const CLASS_ACTIVE_ITEM = 'doc-menu-item-active';

type ClickCallback = (nav: { id: string }) => void;
type DragCallback = (nav: { id: string; parentId?: string; order?: number }) => void;

type EventHandlers = {
  onClickMenu?: ClickCallback;
  onAddMenu?: ClickCallback;
  onDeleteMenu?: ClickCallback;
  onEditMenu?: ClickCallback;
  onMoveMenu?: DragCallback;
};

type TreeDataInitialState = { data?: MenuTreeNode; curMenuId?: string } & EventHandlers;
type TreeDataState = {
  data: MenuTreeNode;
  curMenuId?: string;
  refresh: () => void;
} & EventHandlers;

function useOpenStates() {
  const [openNodeIds, setOpenNodeIds] = useLocalStorageState<{ [id: string]: true }>(
    'open-node-ids',
    {
      defaultValue: {},
    }
  );
  // const { docTree, initialized, allBranchNodeIds } = DocsContainer.useContainer();

  // 初始化时, 自动展开父级结点
  // useEffect(() => {
  //   if (id && initialized) {
  //     const parents = docTree?.findNode(id)?.getParents() || [];
  //     parents.shift();
  //     setOpenNodeIds((prev) => ({ ...prev, ...parents.reduce((acc, cur) => ({ ...acc, [cur.id]: true }), {}) }));
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [id, initialized, docTree]);

  const isOpen = (id: string) => openNodeIds?.[id];
  const toggleOpen = (id: string) => {
    const open = isOpen(id);
    if (open) {
      setOpenNodeIds((prev) => {
        if (prev) {
          delete prev[id];
        }
        return { ...prev };
      });
    } else {
      setOpenNodeIds((prev) => ({ ...prev, [id]: true }));
    }
  };

  const isAnyNodeOpen = openNodeIds && Object.keys(openNodeIds).length > 0;
  const toggleOpenAll = () => {
    const open = openNodeIds && Object.keys(openNodeIds).length > 0;
    if (open) {
      setOpenNodeIds({});
    } else {
      // setOpenNodeIds(allBranchNodeIds.reduce((acc, cur) => ({ ...acc, [cur]: true }), {}));
    }
  };

  return { openNodeIds, isOpen, toggleOpen, toggleOpenAll, isAnyNodeOpen };
}

const OpenStatesContainer = createContainer(useOpenStates);

const TreeData = createContainer<TreeDataState, TreeDataInitialState>(
  ({ data: initialData, ...rest } = {}) => {
    const empty = new MenuTreeNode('root', 'root', new Date());
    const [data, setData] = useState(initialData || empty);
    const refresh = () => {
      const clone = data.clone();
      setData(clone);
    };

    useEffect(() => {
      setData(initialData || empty);
    }, [initialData]);

    const res = {
      data,
      refresh,
      ...rest,
    };
    return res;
  }
);

function MenuItem({ node, subMenu }: { node: MenuTreeNode; subMenu: React.ReactNode }) {
  const {
    data: docTree,
    refresh,
    curMenuId,
    onClickMenu,
    onAddMenu,
    onDeleteMenu,
    onMoveMenu,
    // onEditMenu,
  } = TreeData.useContainer();
  const isActive = curMenuId === node.id;
  const { isOpen, toggleOpen } = OpenStatesContainer.useContainer();
  const open = isOpen(node.id);
  const theme = useTheme();
  const mode = theme.palette.mode;

  // 预留出拖拽图标的空间
  const indent = (node.getDepth() - 1) * 18;

  const [dragging, setDragging] = useState(false);
  // 1: 作子兄弟结点, 2: 作为子结点
  const [hovering, setHovering] = useState<null | 'up' | 'middle' | 'down'>(null);
  const dragRef = useRef<HTMLElement>(null);
  const dropRef = useRef(null);
  useDrag(node.id, dragRef, {
    onDragStart: (e) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      setDragging(true);
    },
    onDragEnd: () => {
      setDragging(false);
    },
  });
  useDrop(dropRef, {
    onDom: async (content: string) => {
      const dragNode = docTree?.findNode(content);
      // 避免拖拽一个 node 到 node 自身或子孙结点上
      if (hovering && dragNode && !dragNode.findNode(node.id)) {
        setTimeout(() => {
          let action: 'moveBefore' | 'moveAfter' | 'appendChild' | undefined;
          switch (hovering) {
            case 'up':
              action = 'moveBefore';
              break;
            case 'middle':
              action = 'appendChild';
              break;
            case 'down':
              action = 'moveAfter';
              break;
            default:
              break;
          }

          if (action) {
            dragNode.moveTo(node, action);
            refresh();

            onMoveMenu &&
              onMoveMenu({
                id: dragNode.id,
                parentId: action === 'appendChild' ? node.id : node.parent?.id,
                order: dragNode.order,
              });
          }
        }, 0);
      }
      setHovering(null);
    },
    onDragOver: (e?: React.DragEvent) => {
      if (e) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        if (
          e.clientY > rect.top + (rect.height * 2) / 3 &&
          e.clientY < rect.top + rect.height
        ) {
          setHovering('down');
        } else if (e.clientY > rect.top && e.clientY < rect.top + rect.height / 3) {
          setHovering('up');
        } else if (
          e.clientY > rect.top + rect.height / 3 &&
          e.clientY < rect.top + (rect.height * 2) / 3
        ) {
          setHovering('middle');
        }
      }
    },
    onDragLeave: () => {
      setHovering(null);
    },
  });

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!open) {
      toggleOpen(node.id);
    }
    if (onClickMenu) {
      onClickMenu({ id: node.id });
    }
  };

  const handleToggleOpen = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    toggleOpen(node.id);
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMore = Boolean(anchorEl);

  const handleClickMore = (event: React.MouseEvent) => {
    event.stopPropagation();
    if ('currentTarget' in event) {
      setAnchorEl(event.currentTarget as HTMLElement);
    }
  };
  const handleCloseMore = () => {
    setAnchorEl(null);
  };

  const menus = useMemo(
    () => [
      // {
      //   key: 'edit',
      //   icon: EditOutlinedIcon,
      //   label: 'Edit',
      //   handle: onEditMenu,
      // },
      {
        key: 'delete',
        icon: DeleteOutlineOutlinedIcon,
        label: 'Delete',
        handle: onDeleteMenu,
      },
    ],
    []
  );

  return (
    <Box
      key={node.id}
      component="li"
      sx={{ listStyle: 'none', mt: '1px', ...(dragging && { border: '1px dashed' }) }}
      draggable
      ref={dragRef}
      className={`${isActive ? CLASS_ACTIVE_ITEM : ''}`}>
      <Box
        ref={dropRef}
        onClick={handleClick}
        // TODO
        // component={Link}
        // to={getDocPagePath(node.id, locale)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          pl: `${indent}px`,
          pr: 1,
          height: 34,
          lineHeight: '34px',
          color: mode === 'dark' ? 'grey.100' : 'grey.800',
          fontSize: 14,
          textDecoration: 'none',
          borderRadius: 1.5,
          cursor: 'pointer',
          ...(isActive
            ? {
                bgcolor:
                  mode === 'dark' ? 'rgba(13, 65, 208, 0.08)' : 'rgba(13, 65, 208, 0.08)',
                color: theme.vars.palette.primary.main,
                fontWeight: 'bold',
              }
            : {}),
          '&:hover': {
            bgcolor: mode === 'dark' ? 'grey.700' : 'grey.200',
            '.doc-menu-item-add': { display: 'flex' },
          },
          ...(hovering === 'middle' && {
            border: '1px dashed',
            borderColor: theme.vars.palette.primary.light,
          }),
        }}
        className="menu-item-link">
        {/* name */}
        <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <Box
            sx={{
              flex: '0 0 auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: 24,
              height: 24,
              mr: 0.5,
              p: 1,
              borderRadius: 1.5,
              visibility: subMenu ? 'visible' : 'hidden',
              '&:hover': { bgcolor: mode === 'dark' ? 'grey.600' : 'grey.300' },
            }}
            onClick={handleToggleOpen}>
            <ArrowForwardIosIcon
              sx={{ fontSize: 12, ...(open && { transform: 'rotate(90deg)' }) }}
            />
          </Box>
          <Typography
            variant="inherit"
            noWrap
            title={node.title}
            className="menu-item-title">
            {node.title}
          </Typography>
        </Box>

        {/* action */}
        <Box className="flex items-center">
          <Box
            id={`${node.id}-more-button`}
            aria-controls={openMore ? `${node.id}-more-menu` : undefined}
            aria-haspopup="true"
            aria-expanded={openMore ? 'true' : undefined}
            onClick={handleClickMore}
            className="doc-menu-item-add"
            sx={{
              flex: '0 0 auto',
              display: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              width: 24,
              height: 24,
              p: 1,
              borderRadius: 1.5,
              '&:hover': { bgcolor: mode === 'dark' ? 'grey.600' : 'grey.300' },
            }}>
            <MoreHorizIcon sx={{ fontSize: 15 }} />
          </Box>
          <MuiMenu
            id={`${node.id}-more-menu`}
            anchorEl={anchorEl}
            open={openMore}
            onClose={handleCloseMore}
            MenuListProps={{
              'aria-labelledby': `${node.id}-more-button`,
            }}>
            {menus.map((menu) => (
              <MuiMenuItem
                className="menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseMore();
                  menu.handle && menu.handle({ id: node.id });
                }}
                key={menu.key}>
                <menu.icon sx={{ mr: 1 }} />
                {menu.label}
              </MuiMenuItem>
            ))}
          </MuiMenu>
          <Box
            className="doc-menu-item-add"
            sx={{
              flex: '0 0 auto',
              display: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              width: 24,
              height: 24,
              p: 1,
              borderRadius: 1.5,
              '&:hover': { bgcolor: mode === 'dark' ? 'grey.600' : 'grey.300' },
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAddMenu) {
                onAddMenu({ id: node.id });
              }
            }}>
            <AddIcon sx={{ fontSize: 15 }} />
          </Box>
        </Box>

        {/* drag line - down */}
        {hovering === 'down' && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: indent,
              right: 0,
              height: '1px',
              border: '1px solid blue',
              borderColor: theme.vars.palette.primary.light,
            }}
          />
        )}

        {/* drag line - up */}
        {hovering === 'up' && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: indent,
              right: 0,
              height: '1px',
              border: '1px solid blue',
              borderColor: theme.vars.palette.primary.light,
            }}
          />
        )}
      </Box>
      {!!subMenu && (
        <Box sx={{ height: open ? 'auto' : 0, overflow: 'hidden' }}>{subMenu}</Box>
      )}
    </Box>
  );
}

function Menu({ nodes }: { nodes: MenuTreeNode[] }) {
  return (
    <Box component="ul" sx={{ m: 0, p: 0 }}>
      {(nodes || []).map((item) => {
        return (
          <MenuItem
            key={item.id}
            node={item}
            subMenu={item.hasChildren() ? <Menu nodes={item.children} /> : null}
          />
        );
      })}
    </Box>
  );
}

function DataWrapper() {
  const { data } = TreeData.useContainer();
  return <Menu nodes={data.children} />;
}

type Props = BoxProps & TreeDataInitialState;

export default function NavTree({
  data,
  curMenuId,
  onClickMenu,
  onAddMenu,
  onDeleteMenu,
  onEditMenu,
  onMoveMenu,
  sx,
  ...rest
}: Props) {
  return (
    <TreeData.Provider
      initialState={{
        data,
        curMenuId,
        onClickMenu,
        onAddMenu,
        onDeleteMenu,
        onEditMenu,
        onMoveMenu,
      }}>
      <OpenStatesContainer.Provider>
        <Box sx={sx} {...rest}>
          <DataWrapper />
        </Box>
      </OpenStatesContainer.Provider>
    </TreeData.Provider>
  );
}

export { MenuTreeNode, MenuTree } from './models';
