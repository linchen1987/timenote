/* eslint-disable */
// @ts-nocheck

import { useRef, useEffect, useState, useMemo, forwardRef, Ref } from 'react';
import { Link } from 'react-router-dom';

import { styled, useTheme } from '@mui/material/styles';
import { Container, Box, Button, Typography } from '@mui/material';

import useMobile from '../../utils/useScreenSize';

function Playground() {
  const { isSmall } = useMobile();

  return (
    <Main>
      <Button>abc</Button>
    </Main>
  );
}

export default function PlaygroundWithTheme() {
  return <Playground />;
}

const Main = styled(Box)`
  ${({ theme: { vars } }) => {
    return `
      background-color: ${vars.palette.background.default};
      color: ${vars.palette.text.primary};
    `;
  }}
  height: 100vh;
`;
