import * as React from 'react';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
// import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';

import api from '../utils/api';
import { useSpace } from '../contexts/spaces';

const emails = ['username@gmail.com', 'user02@gmail.com'];

export interface CreateDialogProps {
  open: boolean;
  selectedValue: string;
  onClose: (value: string) => void;
}

function CreateDialog(props: CreateDialogProps) {
  const { onClose, selectedValue, open } = props;
  const [name, setName] = React.useState<string>('');
  const { setSpace, getSpaces } = useSpace();

  const handleClose = () => {
    onClose(selectedValue);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      const { data } = await api.post('/api/v1/create-space', { name: name });
      setSpace(data);
      onClose(name);
      getSpaces();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <StyledDialog onClose={handleClose} open={open}>
      <DialogTitle>创建笔记本</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent className="dialog-content">
          <TextField
            id="space-name"
            label="名称"
            variant="outlined"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            取消
          </Button>
          <Button disabled={!name} type="submit" onClick={onSubmit}>
            创建
          </Button>
        </DialogActions>
      </form>

      {/* <List sx={{ pt: 0 }}>
        <ListItem disableGutters>
          <ListItemButton autoFocus onClick={() => handleListItemClick('addAccount')}>
            <ListItemAvatar>
              <Avatar>
                <AddIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary="Add account" />
          </ListItemButton>
        </ListItem>
      </List> */}
    </StyledDialog>
  );
}

export default function CreateSpace({ onClose }: { onClose: () => void }) {
  const [selectedValue] = React.useState(emails[1]);

  return <CreateDialog selectedValue={selectedValue} open onClose={onClose} />;
}

const StyledDialog = styled(Dialog)`
  ${() => {
    return `
      .dialog-content {
        padding: 24px;
      }
    `;
  }}
`;
