import { Box } from '@mui/material';
import KeyboardDoubleArrowRight from '@mui/icons-material/KeyboardDoubleArrowRight';
import MenuIcon from '@mui/icons-material/Menu';

import { useLayout } from '../contexts/layout';
import StyledIconButton from './StyledIconButton';

export default function LayoutHeader({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  const { isSmall, setShowDrawer, setShowSidebar, showSidebar } = useLayout();
  return (
    <Box className="mb-4 font-bold flex items-center justify-between">
      <Box className="flex items-center">
        {!isSmall && !showSidebar && (
          <StyledIconButton className="border-none" onClick={() => setShowSidebar(true)}>
            <KeyboardDoubleArrowRight />
          </StyledIconButton>
        )}
        {isSmall && (
          <StyledIconButton className="border-none" onClick={() => setShowDrawer(true)}>
            <MenuIcon />
          </StyledIconButton>
        )}
        <Box>{title || 'Time Note'}</Box>
      </Box>
      <Box>{children}</Box>
    </Box>
  );
}
