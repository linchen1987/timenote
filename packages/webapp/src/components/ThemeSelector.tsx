import { useState, useMemo, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import ContrastOutlinedIcon from '@mui/icons-material/ContrastOutlined';

import { useTheme, Mode } from '../contexts/theme';
import StyledIconButton from './StyledIconButton';

export default function ThemeSelector({
  className,
  hideBorder,
}: {
  className?: string;
  hideBorder?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { mode, setMode } = useTheme();
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSwitchTheme = useCallback(
    (mode: Mode) => {
      setMode!(mode);
      handleClose();
    },
    [setMode]
  );

  const currentIcon = useMemo(() => {
    switch (mode) {
      case 'light':
        return <LightModeOutlinedIcon />;
      case 'dark':
        return <DarkModeOutlinedIcon />;
      default:
        return <ContrastOutlinedIcon />;
    }
  }, [mode]);

  const menus = useMemo(
    () => [
      {
        key: 'light',
        icon: LightModeOutlinedIcon,
        label: '浅色',
      },
      {
        key: 'dark',
        icon: DarkModeOutlinedIcon,
        label: '暗色',
      },
      {
        key: 'system',
        icon: ContrastOutlinedIcon,
        label: '跟随系统',
      },
    ],
    []
  );

  return (
    <>
      <Tooltip title="切换主题">
        <StyledIconButton
          id="theme-select-button"
          size="small"
          aria-controls={open ? 'theme-select-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleClick}
          className={className}
          hideBorder={hideBorder}>
          {currentIcon}
        </StyledIconButton>
      </Tooltip>
      <StyledMenu
        id="theme-select-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'theme-select-button',
        }}>
        {menus.map((menu) => (
          <MenuItem
            className="menu-item"
            onClick={() => handleSwitchTheme(menu.key as Mode)}
            key={menu.key}
            selected={menu.key === mode}>
            <menu.icon sx={{ mr: 1 }} />
            {menu.label}
          </MenuItem>
        ))}
      </StyledMenu>
    </>
  );
}

const StyledMenu = styled(Menu)`
  ${({ theme: { vars } }) => {
    return `
      .MuiSvgIcon-root {
        font-size: 18px;
        color: ${vars.palette.text.secondary};
      }
      .menu-item {
        font-size: 14px;  
        color: ${vars.palette.text.secondary};
      }
    `;
  }}
`;
