import { useEffect, useState, useRef } from 'react';
import { styled } from '@mui/material/styles';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';

import ThemeSelector from './ThemeSelector';
import CreateMenu from './CreateMenu';
import CreateSpace from './CreateSpace';
import { useSpace } from '../contexts/spaces';
import type { Space, MoveMenuParams } from '../contexts/spaces';
import useScreenSize from '../utils/useScreenSize';
import { isPWA } from '../utils';
import StyledIconButton from './StyledIconButton';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import NavTree from './NavTree';

export default function Sidebar({
  showDrawer,
  showSidebar,
  onCloseDrawer,
  onOpenDrawer,
  onCloseSidebar,
}: {
  showDrawer: boolean;
  showSidebar: boolean;
  onCloseDrawer: () => void;
  onOpenDrawer: () => void;
  onCloseSidebar: () => void;
}) {
  const {
    spaces,
    space,
    setSpace,
    initialized,
    menu,
    menuId,
    menus,
    deleteMenu,
    moveMenu,
  } = useSpace();
  const [spaceAnchorEl, setSpaceAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreateSpace, setShowCreateSpace] = useState<boolean>(false);
  const { isSmall } = useScreenSize();
  const [width, setWidth] = useLocalStorage<number>('tn-sidebar-with', 300);
  const isSpaceOpen = Boolean(spaceAnchorEl);
  const [dragging, setDragging] = useState<boolean>(false);
  const navigate = useNavigate();
  const [createProps, setCreateProps] = useState<{ parentId: string } | null>(null);

  const showSpaceList = (event: React.MouseEvent<HTMLButtonElement>) => {
    setSpaceAnchorEl(event.currentTarget);
  };
  const handleSpaceClose = () => {
    setSpaceAnchorEl(null);
  };

  useEffect(() => {
    if (!isSmall) {
      onCloseDrawer();
    }
  }, [isSmall]);

  const dragHandleRef = useRef<HTMLElement>(null);

  const handleMouseDown = () => {
    setDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragHandleRef.current) {
      const newWidth = e.clientX - dragHandleRef.current.getBoundingClientRect().left;
      if (newWidth >= 200) {
        setWidth(newWidth);
      }
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const onChangeSpace = (space: Space) => {
    setSpace!(space);
    handleSpaceClose();
  };

  const _width = isSmall || !showSidebar ? 0 : width;
  const innerWidth = isSmall ? 300 : showSidebar ? width : 0;
  const innerPadding = isSmall || showSidebar ? 16 : 0;

  const onClickMenu = ({ id: menuId }: { id: string }) => {
    const menuItem = menus?.find((x) => x.id === menuId);
    if (menuItem?.postId) {
      navigate(`/s/${space?.id}/m/${menuId}/p/${menuItem.postId}`);
      return;
    }

    navigate(`/s/${space?.id}/m/${menuId}`);
  };

  const onDeleteMenu = ({ id }: { id: string }) => {
    deleteMenu!({ id });
  };

  const onAddMenu = ({ id }: { id: string }) => {
    setCreateProps({ parentId: id });
  };

  const onMoveMenu = ({ id, parentId, order }: MoveMenuParams) => {
    moveMenu({ id, parentId, order });
  };

  const onHome = () => {
    navigate(`/s/${space?.id}`);
  };

  return (
    <StyledSidebar ref={dragHandleRef} style={{ width: _width }}>
      <div
        className={clsx('drag', dragging && 'active')}
        onMouseDown={handleMouseDown}
        style={{ cursor: 'col-resize' }}
      />
      <StyledSwipeableDrawer
        variant={isSmall ? 'temporary' : 'permanent'}
        anchor="left"
        open={isSmall ? showDrawer : showSidebar}
        onClose={onCloseDrawer}
        onOpen={onOpenDrawer}>
        <Box
          className="group flex flex-col h-full"
          style={{ padding: innerPadding, width: innerWidth }}>
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              {!initialized && <div>loading</div>}
              {initialized && !space && (
                <Button
                  id="create-space-button"
                  color="inherit"
                  onClick={() => setShowCreateSpace(true)}>
                  Create Space
                </Button>
              )}
              {initialized && space && (
                <>
                  <Box display="flex">
                    <Button
                      sx={{ ml: -1, mt: -0.5 }}
                      id="space-button"
                      aria-controls={isSpaceOpen ? 'space-menu' : undefined}
                      aria-haspopup="true"
                      aria-expanded={isSpaceOpen ? 'true' : undefined}
                      onClick={showSpaceList}
                      color="inherit">
                      <Typography fontWeight="bold">{space?.name || ''}</Typography>
                      {!isPWA && (
                        <KeyboardArrowDownIcon
                          sx={{ fontSize: '1rem', color: 'text.secondary' }}
                        />
                      )}
                    </Button>
                  </Box>
                  {!isPWA && (
                    <Menu
                      id="space-menu"
                      anchorEl={spaceAnchorEl}
                      open={isSpaceOpen}
                      onClose={handleSpaceClose}
                      MenuListProps={{
                        'aria-labelledby': 'space-button',
                      }}>
                      {(spaces || []).map((x) => (
                        <MenuItem key={x.id} onClick={() => onChangeSpace(x)}>
                          {x.name}
                        </MenuItem>
                      ))}
                      <MenuItem
                        key="create"
                        onClick={() => {
                          handleSpaceClose();
                          setShowCreateSpace(true);
                        }}>
                        创建笔记本
                      </MenuItem>
                      {/* <Box display="flex" flexDirection="row-reverse" px={2}>
                        <ThemeSelector />
                      </Box> */}
                    </Menu>
                  )}
                  {!isSmall && (
                    <StyledIconButton
                      onClick={onCloseSidebar}
                      className="opacity-0 border-none group-hover:opacity-100">
                      <KeyboardDoubleArrowLeftIcon />
                    </StyledIconButton>
                  )}
                </>
              )}
            </Box>
            {showCreateSpace && <CreateSpace onClose={() => setShowCreateSpace(false)} />}
          </Box>
          <Box mt={2} />
          {/* <Box mt={2} mb={1}>
            <Divider />
          </Box> */}
          <Box pt={1} pb={1} className="flex items-center -translate-x-1 sidebar-actions">
            <StyledIconButton hideBorder className="mr-1" onClick={onHome}>
              <HomeOutlinedIcon />
            </StyledIconButton>
            <ThemeSelector hideBorder className="mr-1" />
            <CreateMenu hideBorder />
          </Box>
          {/* <Box mt={1} mb={1}>
            <Divider />
          </Box> */}
          <Box mb={1} />
          <Box className="flex-1" mb={3}>
            {menu && (
              <NavTree
                curMenuId={menuId}
                data={menu}
                onClickMenu={onClickMenu}
                onDeleteMenu={onDeleteMenu}
                onAddMenu={onAddMenu}
                onEditMenu={onClickMenu}
                onMoveMenu={onMoveMenu}
              />
            )}
            {createProps && (
              <CreateMenu
                headless
                parentId={createProps.parentId}
                open
                onClose={() => setCreateProps(null)}
              />
            )}
          </Box>
          {/* bottom */}
          <Box className="demo-tip" sx={{ lineHeight: 1 }}>
            <Typography style={{ marginTop: 0 }} className="font-bold">
              Hello friend:
            </Typography>
            <Typography>
              This is a demo, please do not use it as a production tool.
            </Typography>
            <Typography>Please contact me if you have any questions.</Typography>
            <Typography>
              Twitter:{' '}
              <a href="https://x.com/linklin1987" target="_blank">
                https://x.com/linklin1987
              </a>
            </Typography>

            <Typography>
              Email:{' '}
              <a href="mailto:link.lin.1987@gmail.com" target="_blank">
                link.lin.1987@gmail.com
              </a>
            </Typography>
          </Box>
        </Box>
      </StyledSwipeableDrawer>
    </StyledSidebar>
  );
}

const StyledSwipeableDrawer = styled(SwipeableDrawer)(
  ({ theme }) => `
  .MuiPaper-root {
    border-right: 0.5px solid ${theme.vars.palette.divider};
    background-color: var(--tn-bg-color);
  }
  .sidebar-actions {
    border-radius: 0.5rem;
    background-color: var(--tn-bg-sidebar-icons);
  }
`
);

interface Style {
  showSidebar?: boolean;
}

const StyledSidebar = styled(Box)<Style>(
  ({ showSidebar, theme }) => `
  position: relative;
  overflow-x: hidden;
  .drag {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 5px;
    z-index: ${theme.zIndex.drawer + 1};
    user-select: none;
    &.active, &:hover {
      border-right: 2px solid ${theme.vars.palette.divider};
    }
  }
  flex-shrink: 0;
  ${theme.breakpoints.down('md')} {
    width: 0;
    padding: 0;
  }
  ${showSidebar ? 'padding: 20px;' : ''}
  .menu {
    display: flex;
    align-items: center;
    > svg {
      margin-right: 10px;
    }
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
  }
  .tag {
    margin-right: 10px;
    margin-bottom: 10px;
    padding: 4px 8px;
    border-radius: 5px;
    cursor: pointer;
  }
  .demo-tip {
    background-color: var(--tn-bg-sidebar-icons);
    border-radius: 1rem;
    padding: 1rem;
    p {
      line-height: 1.2;
      margin-top: 0.7rem;
      a {
        color: ${theme.vars.palette.text.secondary};
      }
    }
  }
`
);
