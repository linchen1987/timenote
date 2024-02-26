import { useState } from 'react';
import * as React from 'react';
import { useImmer } from 'use-immer';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

import { useSpace } from '../contexts/spaces';
import type { CreateMenuParams } from '../contexts/spaces';
import StyledIconButton from './StyledIconButton';
import { IconButton } from '@mui/material';

export default function CreateMenu({
  parentId,
  children,
  headless,
  open: inputOpen,
  onClose,
  hideBorder,
}: {
  parentId?: string;
  children?: (open: () => void) => React.ReactNode;
  headless?: boolean;
  open?: boolean;
  onClose?: () => void;
  hideBorder?: boolean;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState('');
  const { createMenu } = useSpace();
  const [keywordsList, setKeywordsList] = useImmer<{ id: number; text: string }[]>([
    { id: Math.random(), text: '' },
  ]);

  const open = inputOpen || showDialog;

  const handleClickOpen = () => {
    setShowDialog(true);
  };

  const handleClose = () => {
    onClose && onClose();
    setShowDialog(false);
    setName('');
    setKeywordsList(() => [{ id: Math.random(), text: '' }]);
  };

  const onKeywordsChange = (id: number, text: string) => {
    setKeywordsList((draft) => {
      const index = draft.findIndex((item) => item.id === id);
      draft[index].text = text;
    });
  };

  const onAddKeywords = (afterId: number) => {
    setKeywordsList((draft) => {
      const index = draft.findIndex((item) => item.id === afterId);
      draft.splice(index + 1, 0, { id: Math.random(), text: '' });
    });
  };

  const onRemoveKeywords = (id: number) => {
    setKeywordsList((draft) => {
      const index = draft.findIndex((item) => item.id === id);
      draft.splice(index, 1);
    });
  };

  const handleSubmit = async () => {
    const params: CreateMenuParams = {
      name,
      config: {
        matchRules: keywordsList.map(({ text }) => ({
          type: 'keywords',
          keywords: text.trim().split(' ').filter(Boolean),
        })),
      },
    };

    if (parentId) {
      Object.assign(params, { parentId });
    }

    try {
      await createMenu(params);
      handleClose();
    } catch (error) {
      console.error(error);
    }
  };

  const button = children ? (
    children(handleClickOpen)
  ) : (
    <Tooltip title="添加">
      <StyledIconButton
        id="theme-select-button"
        size="small"
        aria-controls={open ? 'theme-select-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClickOpen}
        hideBorder={hideBorder}>
        <AddOutlinedIcon />
      </StyledIconButton>
    </Tooltip>
  );

  return (
    <>
      {!headless && button}
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Create Menu</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            required
            margin="dense"
            id="name"
            label="Name"
            fullWidth
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Box mb={2} />
          {keywordsList.map(({ id, text }) => (
            <Box key={id} className="flex items-center">
              <Box className="mr-2">Keywords: </Box>
              <TextField
                required
                margin="dense"
                fullWidth
                variant="standard"
                autoComplete="off"
                value={text}
                onChange={(e) => onKeywordsChange(id, e.target.value)}
              />
              <IconButton
                disabled={keywordsList.length <= 1}
                onClick={() => onRemoveKeywords(id)}>
                <RemoveOutlinedIcon />
              </IconButton>
              <IconButton onClick={() => onAddKeywords(id)}>
                <AddOutlinedIcon />
              </IconButton>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button sx={{ color: 'text.secondary' }} onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!name} onClick={handleSubmit}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
