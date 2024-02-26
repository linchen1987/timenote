import styled from '@emotion/styled';
import useTheme from '@mui/material/styles/useTheme';
import { Box, SvgIconProps } from '@mui/material';
import { CancelRounded as CancelRoundedIcon } from '@mui/icons-material';

export default function NotFound({ title, description }: { title?: string; description?: string }) {
  return (
    <Root>
      <StyledErrorIcon />
      <Box mt={3} fontSize={22} fontWeight={400} color="#47494E" textAlign="center">
        {title ?? '404 - Page Not Found'}
      </Box>
      <Box mt={1} fontSize={14} color="#7F828B" textAlign="center">
        {description ?? '我们找不到您要找的页面'}
      </Box>
    </Root>
  );
}

function StyledErrorIcon(props: SvgIconProps) {
  const theme = useTheme();
  return <CancelRoundedIcon style={{ color: theme.vars.palette.error.main, fontSize: 72 }} {...props} />;
}

const Root = styled('div')`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 16px;

  background-color: #f7f8fb;
`;
