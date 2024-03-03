import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import { styled } from '@mui/material/styles';

export default function SendButton({
  loading,
  onClick = () => {},
}: {
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <StyledButton
      style={{ width: '2.85rem', height: '1.85rem' }}
      disabled={loading}
      className="btn-create"
      variant="contained"
      onClick={() => onClick()}>
      {loading ? <CircularProgress color="inherit" size={14} /> : <SendIcon />}
    </StyledButton>
  );
}

const StyledButton = styled(Button)(
  ({ theme }) => `
    padding: 0.375rem 0.875rem;
    border-radius: 0.5rem;

    min-width: auto;
    box-shadow: none;
    color: ${theme.vars.palette.primary.contrastText};
    .MuiSvgIcon-root {
      font-size: 1.1rem;
    }
  `
);
