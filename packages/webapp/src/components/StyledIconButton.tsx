import React from 'react';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';

type StyledIconButtonProps = React.ComponentProps<typeof IconButton> & {
  width?: number;
  hideBorder?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, StyledIconButtonProps>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ({ width, hideBorder, ...other }, ref) => <IconButton ref={ref} {...other} />
);

const StyledIconButton = styled(Button)`
  ${({ width = 0.3, theme, hideBorder }) => {
    return `
      border: ${hideBorder ? 0 : 1}px solid ${theme.vars.palette.divider};
      padding: ${width}rem;
      border-radius: ${width * 2}rem;
      .MuiSvgIcon-root {
        color: ${theme.vars.palette.text.secondary};
        font-size: ${+width * 4.6}rem;
      }
    `;
  }}
`;

export default StyledIconButton;
