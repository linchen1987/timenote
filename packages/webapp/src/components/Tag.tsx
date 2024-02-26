import type { ReactNode } from 'react';
import { styled } from '@mui/material/styles';
import { Typography, TypographyProps } from '@mui/material';

type TagProps = { label?: string; children?: ReactNode } & TypographyProps;

export default function Tag({ label, children, ...props }: TagProps) {
  return (
    <Style {...props} className={`${props.className} text-xs`}>
      {label}
      {children}
    </Style>
  );
}

const Style = styled(Typography)`
  ${({ theme }) => {
    return `
      display: inline-flex;
      align-items: center;
      border: 2px solid ${theme.vars.palette.divider};
      padding: 4px 8px;
      border-radius: 5px;
      cursor: pointer;
    `;
  }}
`;
